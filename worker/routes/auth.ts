import { Hono } from "hono";
import { z } from "zod";
import {
  clientIp,
  endSession,
  getSiteToken,
  isAuthenticated,
  startSession,
  tokensEqual,
  tooManyAttempts,
  type AuthEnv,
} from "../lib/auth";
import { authRetryAfter, clearAuthFailures, recordAuthFailure } from "../lib/rate-limit";
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
    const ip = clientIp(c);
    const retryAfter = await authRetryAfter(c.env.DB, ip);
    if (retryAfter !== null) return tooManyAttempts(c, retryAfter);
    if (!(await tokensEqual(c.req.valid("json").token, siteToken))) {
      await recordAuthFailure(c.env.DB, ip);
      return c.json({ ok: false as const, error: "令牌不正确" }, 401);
    }
    await clearAuthFailures(c.env.DB, ip);
    await startSession(c, siteToken);
    return c.json({ ok: true as const });
  })
  .post("/auth/logout", (c) => {
    endSession(c);
    return c.json({ ok: true as const });
  });
