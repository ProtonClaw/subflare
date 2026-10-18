import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  nodes: text("nodes").notNull().default("[]"),
  nodeCount: integer("node_count").notNull().default(0),
  userinfo: text("userinfo"),
  autoUpdateInterval: integer("auto_update_interval"),
  lastRefreshedAt: integer("last_refreshed_at"),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
