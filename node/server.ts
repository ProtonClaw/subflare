import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import worker from "../worker/index";
import { createD1 } from "./d1";
import { createKV } from "./kv";
import { applyMigrations } from "./migrate";

// Paths are relative to the working directory: the repo root locally, /app in the Docker image.
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? "data";
const ASSETS_DIR = "dist/client";
const MIGRATIONS_DIR = "migrations/sqlite";
const CRON = "*/10 * * * *";
const CRON_INTERVAL_MS = 10 * 60_000;

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(join(DATA_DIR, "subflare.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
const migrated = applyMigrations(db, MIGRATIONS_DIR);
if (migrated.length > 0) console.log(`[db] applied migrations: ${migrated.join(", ")}`);

const env = { DB: createD1(db), KV: createKV(db), SUBFLARE_TOKEN: process.env.SUBFLARE_TOKEN ?? "" } as Env;
const ctx = {
  waitUntil: (promise: Promise<unknown>) => void promise.catch((error) => console.error("[waitUntil]", error)),
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;

// Reverse proxies (nginx, Caddy, …) report the real client and scheme via X-Forwarded-* headers.
function toWorkerRequest(c: Context): Request {
  const raw = c.req.raw;
  const url = new URL(raw.url);
  const proto = c.req.header("x-forwarded-proto")?.split(",")[0].trim();
  const host = c.req.header("x-forwarded-host")?.split(",")[0].trim();
  if (proto === "http" || proto === "https") url.protocol = `${proto}:`;
  if (host) url.host = host;
  const ip =
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
    getConnInfo(c).remote.address?.replace(/^::ffff:/, "");
  const headers = new Headers(raw.headers);
  if (ip) headers.set("cf-connecting-ip", ip);
  else headers.delete("cf-connecting-ip");
  const hasBody = raw.method !== "GET" && raw.method !== "HEAD";
  return new Request(url, { method: raw.method, headers, body: hasBody ? raw.body : null, duplex: "half" } as RequestInit);
}

const app = new Hono();
const forward = (c: Context) => worker.fetch!(toWorkerRequest(c) as Parameters<NonNullable<typeof worker.fetch>>[0], env, ctx);
app.all("/api/*", forward);
app.all("/s/*", forward);
app.use(
  "/assets/*",
  serveStatic({
    root: ASSETS_DIR,
    onFound: (_path, c) => c.header("Cache-Control", "public, max-age=31536000, immutable"),
  })
);
app.use("*", serveStatic({ root: ASSETS_DIR }));
app.get("*", serveStatic({ root: ASSETS_DIR, path: "index.html" }));

function runCron() {
  const controller = { cron: CRON, scheduledTime: Date.now(), noRetry: () => {} } as ScheduledController;
  Promise.resolve(worker.scheduled!(controller, env, ctx)).catch((error) => console.error("[cron]", error));
}
setTimeout(runCron, 10_000);
const cronTimer = setInterval(runCron, CRON_INTERVAL_MS);

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`SubFlare listening on http://localhost:${info.port}`);
  if (!env.SUBFLARE_TOKEN) console.warn("SUBFLARE_TOKEN is not set; login is disabled until it is configured.");
});

function shutdown() {
  clearInterval(cronTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
