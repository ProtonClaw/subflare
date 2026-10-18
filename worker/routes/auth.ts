import { Hono } from "hono";
import { z } from "zod";
import { endSession, getSiteToken, isAuthenticated, startSession, tokensEqual, type AuthEnv } from "../lib/auth";
import { validate } from "../lib/validate";

export const authRoutes = new Hono<AuthEnv>()
  .get("/auth/me", async (c) => {
    const siteToken = getSiteToken(c.env);
    return c.json({
      configured: siteToken !== null,
      authenticated: siteToken !== null && (await isAuthenticated(c, siteToken)),
    });
  })
  .post("/auth/login", validate("json", z.object({ token: z.string().min(1).max(512) })), async (c) => {
    const siteToken = getSiteToken(c.env);
    if (!siteToken) return c.json({ ok: false as const, error: "SUBFLARE_TOKEN 未配置" }, 503);
    if (!(await tokensEqual(c.req.valid("json").token, siteToken))) {
      return c.json({ ok: false as const, error: "令牌不正确" }, 401);
    }
    await startSession(c, siteToken);
    return c.json({ ok: true as const });
  })
  .post("/auth/logout", (c) => {
    endSession(c);
    return c.json({ ok: true as const });
  });
