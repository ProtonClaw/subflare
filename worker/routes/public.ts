import { Hono } from "hono";
import { createD1SubscriptionRepository } from "../db/repo";
import { describePull } from "../lib/pull-log";
import { getCachedYaml } from "../lib/render";
import { buildSubscriptionResponseHeaders } from "../lib/response-headers";

export const publicRoutes = new Hono<{ Bindings: Env }>().get("/s/:token", async (c) => {
  const repo = createD1SubscriptionRepository(c.env.DB);
  const token = c.req.param("token");
  const sub = await repo.getByToken(token);
  const entry = describePull(c.req.raw);
  const now = Date.now();
  if (!sub) {
    c.executionCtx.waitUntil(
      repo.recordRetiredTokenPull(token, entry, now).catch((error) => console.error("[pull] record retired failed", error))
    );
    return c.text("Not Found", 404);
  }
  const yaml = await getCachedYaml(c.env, sub);
  c.executionCtx.waitUntil(
    repo
      .recordPull(sub.id, yaml === null ? "empty" : "ok", entry, now)
      .catch((error) => console.error(`[pull] record ${sub.id} failed`, error))
  );
  if (yaml === null) return c.text("No nodes available", 404);
  return c.body(
    yaml,
    200,
    buildSubscriptionResponseHeaders(sub.name, sub.userinfo ?? {}, {
      cacheControl: "no-store",
      autoUpdateIntervalSeconds: sub.autoUpdateInterval,
      isAdmin: true,
    })
  );
});
