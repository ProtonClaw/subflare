import { validateSubBoostTemplateConfig } from "@subboost/core/templates/config-template";
import { drizzle } from "drizzle-orm/d1";
import type { BatchItem } from "drizzle-orm/batch";
import { Hono } from "hono";
import { z } from "zod";
import { subscriptions, templates } from "../db/schema";
import { requireAuth, type AuthEnv } from "../lib/auth";
import { invalidateYaml } from "../lib/render";
import { validate } from "../lib/validate";

// Backups are raw table rows (JSON columns kept as strings), so restore is lossless and keeps
// subscription tokens: links already imported into clients keep working. Pull logs are not included.
const BACKUP_FORMAT = "subflare-backup/v1";

function isJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

const JsonText = z.string().refine(isJson, "不是合法的 JSON");
const Timestamp = z.number().int().nonnegative();

const TemplateRowSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  config: JsonText,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});

const SubscriptionRowSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  note: z.string().max(500).default(""),
  token: z.string().min(16).max(64),
  mode: z.enum(["provider", "snapshot"]),
  config: JsonText,
  templateId: z.string().min(1).max(64).nullable(),
  nodes: JsonText,
  nodeCount: z.number().int().nonnegative(),
  userinfo: JsonText.nullable(),
  autoUpdateInterval: z.number().int().positive().nullable(),
  lastRefreshedAt: Timestamp.nullable(),
  lastError: z.string().nullable(),
  lastPulledAt: Timestamp.nullable(),
  lastClient: z.string().nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  exportedAt: Timestamp,
  templates: z.array(TemplateRowSchema).max(200),
  // Keeps cache invalidation within the 1000 KV operations per invocation limit.
  subscriptions: z.array(SubscriptionRowSchema).max(300),
});

const base = new Hono<AuthEnv>();
base.use("/backup", requireAuth);

export const backupRoutes = base
  .get("/backup", async (c) => {
    const db = drizzle(c.env.DB);
    const [templateRows, subscriptionRows] = await Promise.all([
      db.select().from(templates).all(),
      db.select().from(subscriptions).all(),
    ]);
    const exportedAt = Date.now();
    const date = new Date(exportedAt + 8 * 3600_000).toISOString().slice(0, 10);
    c.header("Content-Disposition", `attachment; filename="subflare-backup-${date}.json"`);
    c.header("Cache-Control", "no-store");
    return c.json({ format: BACKUP_FORMAT, exportedAt, templates: templateRows, subscriptions: subscriptionRows });
  })
  .post("/backup", validate("json", BackupSchema), async (c) => {
    const backup = c.req.valid("json");
    const db = drizzle(c.env.DB);

    for (const t of backup.templates) {
      const result = validateSubBoostTemplateConfig(JSON.parse(t.config));
      if (!result.ok) return c.json({ error: `模板「${t.name}」无效：${result.error}`, code: "INVALID_TEMPLATE" as const }, 400);
    }
    const existingTemplates = await db.select({ id: templates.id }).from(templates).all();
    const templateIds = new Set([...existingTemplates.map((t) => t.id), ...backup.templates.map((t) => t.id)]);
    const orphan = backup.subscriptions.find((s) => s.templateId && !templateIds.has(s.templateId));
    if (orphan) return c.json({ error: `订阅「${orphan.name}」引用的模板不存在`, code: "TEMPLATE_NOT_FOUND" as const }, 400);

    const statements: BatchItem<"sqlite">[] = [
      ...backup.templates.map(({ id, ...rest }) =>
        db.insert(templates).values({ id, ...rest }).onConflictDoUpdate({ target: templates.id, set: rest })
      ),
      ...backup.subscriptions.map(({ id, ...rest }) =>
        db.insert(subscriptions).values({ id, ...rest }).onConflictDoUpdate({ target: subscriptions.id, set: rest })
      ),
    ];
    if (statements.length === 0) return c.json({ templates: 0, subscriptions: 0 });

    const previousTokens = await db.select({ id: subscriptions.id, token: subscriptions.token }).from(subscriptions).all();
    try {
      await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/UNIQUE constraint failed: subscriptions\.token/i.test(message)) {
        return c.json({ error: "备份中的订阅链接与现有的其他订阅冲突", code: "TOKEN_CONFLICT" as const }, 409);
      }
      throw error;
    }

    // Only overwritten rows can have cached YAML: tokens are unique and deletes already clear the cache.
    const importedTokens = new Map(backup.subscriptions.map((s) => [s.id, s.token]));
    const stale = previousTokens.flatMap((p) => {
      const next = importedTokens.get(p.id);
      return next === undefined ? [] : next === p.token ? [p.token] : [p.token, next];
    });
    await Promise.all(stale.map((token) => invalidateYaml(c.env.KV, token)));
    return c.json({ templates: backup.templates.length, subscriptions: backup.subscriptions.length });
  });
