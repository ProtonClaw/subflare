import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  mode: text("mode", { enum: ["provider", "snapshot"] }).notNull(),
  config: text("config").notNull(),
  /** Mirrors config.templateId so template usage can be queried without JSON functions. */
  templateId: text("template_id"),
  nodes: text("nodes").notNull().default("[]"),
  nodeCount: integer("node_count").notNull().default(0),
  userinfo: text("userinfo"),
  autoUpdateInterval: integer("auto_update_interval"),
  lastRefreshedAt: integer("last_refreshed_at"),
  lastError: text("last_error"),
  lastPulledAt: integer("last_pulled_at"),
  lastClient: text("last_client"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** SubBoost-compatible `subboost-template-config/v1` JSON. */
  config: text("config").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pullStats = sqliteTable(
  "pull_stats",
  {
    subscriptionId: text("subscription_id").notNull(),
    /** Beijing-time (UTC+8) date, YYYY-MM-DD. */
    day: text("day").notNull(),
    client: text("client").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.subscriptionId, t.day, t.client] }), index("pull_stats_day_idx").on(t.day)]
);

export const pullLogs = sqliteTable(
  "pull_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subscriptionId: text("subscription_id").notNull(),
    at: integer("at").notNull(),
    /** ok: served; empty: no nodes to serve; revoked: pulled with a token retired by rotation. */
    status: text("status", { enum: ["ok", "empty", "revoked"] }).notNull(),
    ip: text("ip"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    asn: integer("asn"),
    asOrg: text("as_org"),
    colo: text("colo"),
    client: text("client").notNull(),
    userAgent: text("user_agent"),
  },
  (t) => [index("pull_logs_sub_idx").on(t.subscriptionId, t.id), index("pull_logs_at_idx").on(t.at)]
);

/** Tokens replaced by rotation, so pulls with an old link can still be attributed. */
export const retiredTokens = sqliteTable(
  "retired_tokens",
  {
    token: text("token").primaryKey(),
    subscriptionId: text("subscription_id").notNull(),
    retiredAt: integer("retired_at").notNull(),
  },
  (t) => [index("retired_tokens_sub_idx").on(t.subscriptionId)]
);
