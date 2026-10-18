import { DEFAULT_BASE_CONFIG_YAML, buildDefaultSubBoostTemplateConfig } from "@subboost/core/config/defaults";
import { CATEGORY_INFO, PROXY_GROUP_MODULES, getModulesForTemplate } from "@subboost/core/generator/proxy-groups";
import { getTemplateList } from "@subboost/core/templates";
import type { ParsedNode } from "@subboost/core/types/node";
import { Hono } from "hono";
import { z } from "zod";
import { getNodeSourceIds } from "@subboost/core/subscription/node-source-state";
import {
  createD1SubscriptionRepository,
  statsDay,
  type DeletedNode,
  type NewSubscription,
  type Source,
  type Subscription,
} from "../db/repo";
import { createD1TemplateRepository } from "../db/templates-repo";
import { requireAuth, type AuthEnv } from "../lib/auth";
import { validate } from "../lib/validate";
import { invalidateYaml, loadTemplateConfig, renderYaml } from "../lib/render";
import { applyNodeEdits, buildSnapshot, listNodeState } from "../lib/snapshot";
import { collectNodes } from "../lib/sources";

const MAX_PREVIEW_NODES = 500;

const SourceSchema = z.object({
  id: z.string().trim().min(1).max(64),
  type: z.enum(["url", "nodes"]),
  content: z.string().trim().min(1).max(2_000_000),
});

const ModeSchema = z.enum(["provider", "snapshot"]);

const SubscriptionInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mode: ModeSchema,
  config: z.object({
    sources: z.array(SourceSchema).min(1).max(20),
    template: z.enum(["minimal", "standard", "full"]),
    enabledGroups: z.array(z.string().max(64)).max(200).optional(),
    templateId: z.string().min(1).max(64).optional(),
  }),
  autoUpdateInterval: z.number().int().min(1800).max(7 * 86400).nullable(),
});

const NodeEditsSchema = z.object({
  rename: z.array(z.object({ from: z.string().min(1).max(200), to: z.string().max(200) })).max(5000).optional(),
  delete: z.array(z.string().min(1).max(200)).max(5000).optional(),
  restore: z.array(z.number().int().min(0)).max(1000).optional(),
});

const PreviewSchema = z.object({ mode: ModeSchema, sources: z.array(SourceSchema).min(1).max(20) });

function summarizeNodes(nodes: ParsedNode[]) {
  return nodes.slice(0, MAX_PREVIEW_NODES).map((n) => ({ name: n.name, type: n.type, server: n.server, port: n.port }));
}

function toDetail(sub: Subscription) {
  const { nodes, config, ...rest } = sub;
  const { deletedNodes, ...publicConfig } = config;
  return { ...rest, config: publicConfig, deletedNodeCount: deletedNodes?.length ?? 0, nodes: summarizeNodes(nodes) };
}

/** Drops deletion records whose source no longer exists. */
function keepDeletedForSources(deleted: DeletedNode[] | undefined, sources: Source[]): DeletedNode[] {
  const ids = new Set(sources.map((s) => s.id));
  return (deleted ?? []).filter((item) => getNodeSourceIds(item.node).some((id) => ids.has(id)));
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function templateMissing(db: D1Database, input: NewSubscription): Promise<boolean> {
  const id = input.config.templateId;
  return !!id && !(await createD1TemplateRepository(db).get(id));
}

const PROTECTED = ["/meta", "/preview", "/stats/*", "/subscriptions", "/subscriptions/*"] as const;

const base = new Hono<AuthEnv>();
for (const path of PROTECTED) base.use(path, requireAuth);

export const subscriptionRoutes = base
  .get("/meta", (c) =>
    c.json({
      templates: getTemplateList().map((t) => ({ ...t, groups: getModulesForTemplate(t.id) })),
      modules: PROXY_GROUP_MODULES.map(({ id, name, emoji, category, description, rules }) => ({
        id,
        name,
        emoji,
        category,
        description,
        ruleCount: rules.length,
      })),
      categories: CATEGORY_INFO,
      templateDefaults: {
        minimal: buildDefaultSubBoostTemplateConfig("minimal"),
        standard: buildDefaultSubBoostTemplateConfig("standard"),
        full: buildDefaultSubBoostTemplateConfig("full"),
      },
      baseConfigYaml: DEFAULT_BASE_CONFIG_YAML,
    })
  )
  .post("/preview", validate("json", PreviewSchema), async (c) => {
    const { mode, sources } = c.req.valid("json");
    const collected = await collectNodes(sources, { mode, fetchRemote: true });
    return c.json({
      sources: collected.sources,
      nodeCount: collected.allNodes.length,
      nodes: summarizeNodes(collected.allNodes),
      userinfo: collected.userinfo,
    });
  })
  .get("/stats/pulls", validate(
    "query",
    z.object({
      days: z.coerce.number().int().min(1).max(30).default(7),
      subscriptionId: z.string().min(1).max(64).optional(),
    })
  ), async (c) => {
    const { days, subscriptionId } = c.req.valid("query");
    const now = Date.now();
    const dayKeys = Array.from({ length: days }, (_, i) => statsDay(now - (days - 1 - i) * 86_400_000));
    const rows = await createD1SubscriptionRepository(c.env.DB).listPullStats(dayKeys[0], subscriptionId);

    const perDay = new Map(dayKeys.map((d) => [d, 0]));
    const perClient = new Map<string, number>();
    const perSubscription: Record<string, number> = {};
    for (const r of rows) {
      perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.count);
      perClient.set(r.client, (perClient.get(r.client) ?? 0) + r.count);
      perSubscription[r.subscriptionId] = (perSubscription[r.subscriptionId] ?? 0) + r.count;
    }
    return c.json({
      total: rows.reduce((sum, r) => sum + r.count, 0),
      days: dayKeys.map((day) => ({ day, count: perDay.get(day) ?? 0 })),
      clients: [...perClient].map(([client, count]) => ({ client, count })).sort((a, b) => b.count - a.count),
      perSubscription,
    });
  })
  .get("/subscriptions", async (c) => {
    return c.json({ items: await createD1SubscriptionRepository(c.env.DB).list() });
  })
  .post("/subscriptions", validate("json", SubscriptionInputSchema), async (c) => {
    const input = c.req.valid("json");
    if (await templateMissing(c.env.DB, input)) return c.json({ error: "模板不存在", code: "TEMPLATE_NOT_FOUND" as const }, 400);
    const refresh = await buildSnapshot(input);
    const sub = await createD1SubscriptionRepository(c.env.DB).create(
      { ...input, id: crypto.randomUUID(), token: newToken() },
      refresh
    );
    return c.json(toDetail(sub), 201);
  })
  .get("/subscriptions/:id", async (c) => {
    const sub = await createD1SubscriptionRepository(c.env.DB).get(c.req.param("id"));
    return sub ? c.json(toDetail(sub), 200) : c.json({ error: "Not Found" }, 404);
  })
  .put("/subscriptions/:id", validate("json", SubscriptionInputSchema), async (c) => {
    const repo = createD1SubscriptionRepository(c.env.DB);
    const previous = await repo.get(c.req.param("id"));
    if (!previous) return c.json({ error: "Not Found" }, 404);
    const body = c.req.valid("json");
    if (await templateMissing(c.env.DB, body)) return c.json({ error: "模板不存在", code: "TEMPLATE_NOT_FOUND" as const }, 400);
    const deletedNodes = keepDeletedForSources(previous.config.deletedNodes, body.config.sources);
    const input = { ...body, config: { ...body.config, ...(deletedNodes.length > 0 ? { deletedNodes } : {}) } };
    const refresh = await buildSnapshot(input, previous);
    const sub = await repo.update(previous.id, input, refresh);
    if (!sub) return c.json({ error: "Not Found" }, 404);
    await invalidateYaml(c.env.KV, sub.token);
    return c.json(toDetail(sub), 200);
  })
  .post("/subscriptions/:id/refresh", async (c) => {
    const repo = createD1SubscriptionRepository(c.env.DB);
    const sub = await repo.get(c.req.param("id"));
    if (!sub) return c.json({ error: "Not Found" }, 404);
    const refresh = await buildSnapshot(sub, sub);
    await repo.saveRefresh(sub.id, refresh);
    await invalidateYaml(c.env.KV, sub.token);
    return c.json(toDetail({ ...sub, ...refresh, nodeCount: refresh.nodes.length, lastRefreshedAt: Date.now() }), 200);
  })
  .post("/subscriptions/:id/rotate-token", async (c) => {
    const repo = createD1SubscriptionRepository(c.env.DB);
    const sub = await repo.get(c.req.param("id"));
    if (!sub) return c.json({ error: "Not Found" }, 404);
    const token = await repo.rotateToken(sub.id, newToken());
    await invalidateYaml(c.env.KV, sub.token);
    return c.json({ token }, 200);
  })
  .delete("/subscriptions/:id", async (c) => {
    const sub = await createD1SubscriptionRepository(c.env.DB).delete(c.req.param("id"));
    if (!sub) return c.json({ error: "Not Found" }, 404);
    await invalidateYaml(c.env.KV, sub.token);
    return c.json({ ok: true }, 200);
  })
  .get("/subscriptions/:id/nodes", async (c) => {
    const sub = await createD1SubscriptionRepository(c.env.DB).get(c.req.param("id"));
    return sub ? c.json(listNodeState(sub), 200) : c.json({ error: "Not Found" }, 404);
  })
  .patch("/subscriptions/:id/nodes", validate("json", NodeEditsSchema), async (c) => {
    const repo = createD1SubscriptionRepository(c.env.DB);
    const sub = await repo.get(c.req.param("id"));
    if (!sub) return c.json({ error: "Not Found" }, 404);
    const result = applyNodeEdits(sub.nodes, sub.config.deletedNodes ?? [], c.req.valid("json"));
    if (!result.ok) return c.json({ error: result.error, code: "INVALID_NODE_EDIT" as const }, 400);
    const { deletedNodes: _previous, ...config } = sub.config;
    const saved = await repo.saveNodes(sub.id, result.nodes, {
      ...config,
      ...(result.deletedNodes.length > 0 ? { deletedNodes: result.deletedNodes } : {}),
    });
    if (!saved) return c.json({ error: "Not Found" }, 404);
    await invalidateYaml(c.env.KV, saved.token);
    return c.json(listNodeState(saved), 200);
  })
  .get("/subscriptions/:id/yaml", async (c) => {
    const sub = await createD1SubscriptionRepository(c.env.DB).get(c.req.param("id"));
    if (!sub) return c.json({ error: "Not Found" }, 404);
    const yaml = renderYaml(sub, await loadTemplateConfig(c.env.DB, sub));
    return yaml === null ? c.json({ error: "没有可用节点" }, 422) : c.text(yaml, 200);
  });
