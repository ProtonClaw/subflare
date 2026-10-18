import { Hono } from "hono";
import { createD1SubscriptionRepository } from "../db/repo";
import { detectClient } from "../lib/client";
import { getCachedYaml } from "../lib/render";
import { buildSubscriptionResponseHeaders } from "../lib/response-headers";

export const publicRoutes = new Hono<{ Bindings: Env }>().get("/s/:token", async (c) => {
  const repo = createD1SubscriptionRepository(c.env.DB);
  const sub = await repo.getByToken(c.req.param("token"));
  if (!sub) return c.text("Not Found", 404);
  const yaml = await getCachedYaml(c.env, sub);
  if (yaml === null) return c.text("No nodes available", 404);
  c.executionCtx.waitUntil(
    repo
      .recordPull(sub.id, detectClient(c.req.header("user-agent")), Date.now())
      .catch((error) => console.error(`[pull] record ${sub.id} failed`, error))
  );
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
