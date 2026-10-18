import { Hono } from "hono";
import { createD1SubscriptionRepository } from "../db/repo";
import { getCachedYaml } from "../lib/render";
import { buildSubscriptionResponseHeaders } from "../lib/response-headers";

export const publicRoutes = new Hono<{ Bindings: Env }>().get("/s/:token", async (c) => {
  const sub = await createD1SubscriptionRepository(c.env.DB).getByToken(c.req.param("token"));
  if (!sub) return c.text("Not Found", 404);
  const yaml = await getCachedYaml(c.env.KV, sub);
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
