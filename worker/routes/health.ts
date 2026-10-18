import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

type Check = { ok: boolean; latencyMs: number; error?: string };

async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - start, error: error instanceof Error ? error.message : String(error) };
  }
}

export const healthRoutes = new Hono<{ Bindings: Env }>().get("/health", async (c) => {
  const [db, kv] = await Promise.all([
    timed(() => drizzle(c.env.DB).run(sql`select 1`)),
    timed(() => c.env.KV.get("health-probe")),
  ]);
  const ok = db.ok && kv.ok;
  return c.json(
    { status: ok ? ("ok" as const) : ("degraded" as const), time: new Date().toISOString(), checks: { db, kv } },
    ok ? 200 : 503
  );
});
