import type { ParsedNode } from "@subboost/core/types/node";
import type { SubscriptionUserInfo } from "@subboost/core/subscription/subscription-userinfo";
import { and, desc, eq, gte, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { pullStats, subscriptions } from "./schema";

export type SourceType = "url" | "nodes";

export type Source = {
  id: string;
  type: SourceType;
  content: string;
};

export type TemplateId = "minimal" | "standard" | "full";

export type SubscriptionConfig = {
  sources: Source[];
  template: TemplateId;
  enabledGroups?: string[];
  /** Custom template reference; when set, `template` and `enabledGroups` are ignored. */
  templateId?: string;
};

export type SubscriptionMode = "provider" | "snapshot";

export type Subscription = {
  id: string;
  name: string;
  token: string;
  mode: SubscriptionMode;
  config: SubscriptionConfig;
  templateId: string | null;
  nodes: ParsedNode[];
  nodeCount: number;
  userinfo: SubscriptionUserInfo | null;
  autoUpdateInterval: number | null;
  lastRefreshedAt: number | null;
  lastError: string | null;
  lastPulledAt: number | null;
  lastClient: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SubscriptionSummary = Omit<Subscription, "nodes" | "config"> & {
  template: TemplateId;
  sourceCount: number;
};

export type NewSubscription = Pick<Subscription, "name" | "mode" | "config" | "autoUpdateInterval">;

export type RefreshResult = Pick<Subscription, "nodes" | "userinfo" | "lastError">;

export type PullStatRow = { subscriptionId: string; day: string; client: string; count: number };

export interface SubscriptionRepository {
  list(): Promise<SubscriptionSummary[]>;
  get(id: string): Promise<Subscription | null>;
  getByToken(token: string): Promise<Subscription | null>;
  create(input: NewSubscription & Pick<Subscription, "id" | "token">, refresh: RefreshResult): Promise<Subscription>;
  update(id: string, input: NewSubscription, refresh: RefreshResult): Promise<Subscription | null>;
  saveRefresh(id: string, refresh: RefreshResult): Promise<void>;
  rotateToken(id: string, token: string): Promise<string | null>;
  delete(id: string): Promise<Subscription | null>;
  listDueForRefresh(now: number, limit: number): Promise<Subscription[]>;
  listByTemplate(templateId: string): Promise<Array<Pick<Subscription, "id" | "name" | "token">>>;
  recordPull(id: string, client: string, now: number): Promise<void>;
  listPullStats(sinceDay: string, subscriptionId?: string): Promise<PullStatRow[]>;
  prunePullStats(beforeDay: string): Promise<void>;
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

type Row = typeof subscriptions.$inferSelect;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toSubscription(row: Row): Subscription {
  return {
    ...row,
    config: parseJson<SubscriptionConfig>(row.config, { sources: [], template: "standard" }),
    nodes: parseJson<ParsedNode[]>(row.nodes, []),
    userinfo: parseJson<SubscriptionUserInfo | null>(row.userinfo, null),
  };
}

function toSummary(row: Row): SubscriptionSummary {
  const { nodes: _nodes, config: rawConfig, ...rest } = toSubscription(row);
  return { ...rest, template: rawConfig.template, sourceCount: rawConfig.sources.length };
}

function refreshColumns(refresh: RefreshResult, now: number) {
  return {
    nodes: JSON.stringify(refresh.nodes),
    nodeCount: refresh.nodes.length,
    userinfo: refresh.userinfo ? JSON.stringify(refresh.userinfo) : null,
    lastError: refresh.lastError,
    lastRefreshedAt: now,
  };
}

export function createD1SubscriptionRepository(d1: D1Database): SubscriptionRepository {
  const db = drizzle(d1);

  const get = async (id: string) => {
    const row = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).get();
    return row ? toSubscription(row) : null;
  };

  return {
    async list() {
      const rows = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).all();
      return rows.map(toSummary);
    },
    get,
    async getByToken(token) {
      const row = await db.select().from(subscriptions).where(eq(subscriptions.token, token)).get();
      return row ? toSubscription(row) : null;
    },
    async create(input, refresh) {
      const now = Date.now();
      const row = await db
        .insert(subscriptions)
        .values({
          id: input.id,
          token: input.token,
          name: input.name,
          mode: input.mode,
          config: JSON.stringify(input.config),
          templateId: input.config.templateId ?? null,
          autoUpdateInterval: input.autoUpdateInterval,
          ...refreshColumns(refresh, now),
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      return toSubscription(row);
    },
    async update(id, input, refresh) {
      const now = Date.now();
      const row = await db
        .update(subscriptions)
        .set({
          name: input.name,
          mode: input.mode,
          config: JSON.stringify(input.config),
          templateId: input.config.templateId ?? null,
          autoUpdateInterval: input.autoUpdateInterval,
          ...refreshColumns(refresh, now),
          updatedAt: now,
        })
        .where(eq(subscriptions.id, id))
        .returning()
        .get();
      return row ? toSubscription(row) : null;
    },
    async saveRefresh(id, refresh) {
      await db.update(subscriptions).set(refreshColumns(refresh, Date.now())).where(eq(subscriptions.id, id)).run();
    },
    async rotateToken(id, token) {
      const row = await db
        .update(subscriptions)
        .set({ token, updatedAt: Date.now() })
        .where(eq(subscriptions.id, id))
        .returning({ token: subscriptions.token })
        .get();
      return row?.token ?? null;
    },
    async delete(id) {
      const [rows] = await db.batch([
        db.delete(subscriptions).where(eq(subscriptions.id, id)).returning(),
        db.delete(pullStats).where(eq(pullStats.subscriptionId, id)),
      ]);
      return rows[0] ? toSubscription(rows[0]) : null;
    },
    async listDueForRefresh(now, limit) {
      const rows = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.mode, "snapshot"),
            isNotNull(subscriptions.autoUpdateInterval),
            or(
              isNull(subscriptions.lastRefreshedAt),
              lte(sql`${subscriptions.lastRefreshedAt} + ${subscriptions.autoUpdateInterval} * 1000`, now)
            )
          )
        )
        .orderBy(subscriptions.lastRefreshedAt)
        .limit(limit)
        .all();
      return rows.map(toSubscription);
    },
    async listByTemplate(templateId) {
      return db
        .select({ id: subscriptions.id, name: subscriptions.name, token: subscriptions.token })
        .from(subscriptions)
        .where(eq(subscriptions.templateId, templateId))
        .all();
    },
    async recordPull(id, client, now) {
      await db.batch([
        db
          .insert(pullStats)
          .values({ subscriptionId: id, day: utcDay(now), client, count: 1 })
          .onConflictDoUpdate({
            target: [pullStats.subscriptionId, pullStats.day, pullStats.client],
            set: { count: sql`${pullStats.count} + 1` },
          }),
        db.update(subscriptions).set({ lastPulledAt: now, lastClient: client }).where(eq(subscriptions.id, id)),
      ]);
    },
    async listPullStats(sinceDay, subscriptionId) {
      return db
        .select()
        .from(pullStats)
        .where(and(gte(pullStats.day, sinceDay), subscriptionId ? eq(pullStats.subscriptionId, subscriptionId) : undefined))
        .all();
    },
    async prunePullStats(beforeDay) {
      await db.delete(pullStats).where(lt(pullStats.day, beforeDay)).run();
    },
  };
}
