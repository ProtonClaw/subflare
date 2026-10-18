import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { authRetryAfter, recordAuthFailure } from "./rate-limit";

export const SESSION_COOKIE = "sf_session";
const SESSION_TTL_SECONDS = 30 * 24 * 3600;
const MIN_TOKEN_LENGTH = 8;

export type AuthEnv = { Bindings: Env };

export function getSiteToken(env: Env): string | null {
  const token = (env as { SUBFLARE_TOKEN?: string }).SUBFLARE_TOKEN?.trim();
  return token && token.length >= MIN_TOKEN_LENGTH ? token : null;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function tokensEqual(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function startSession(c: Context<AuthEnv>, siteToken: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const jwt = await sign({ sub: "admin", exp }, siteToken, "HS256");
  setCookie(c, SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function endSession(c: Context<AuthEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function isAuthenticated(c: Context<AuthEnv>, siteToken: string): Promise<boolean> {
  const bearer = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return tokensEqual(bearer, siteToken);

  const session = getCookie(c, SESSION_COOKIE);
  if (!session) return false;
  try {
    await verify(session, siteToken, "HS256");
    return true;
  } catch {
    return false;
  }
}

export function clientIp(c: Context<AuthEnv>): string {
  return c.req.header("cf-connecting-ip") ?? "unknown";
}

export function tooManyAttempts(c: Context<AuthEnv>, retryAfter: number) {
  c.header("Retry-After", String(retryAfter));
  return c.json(
    { ok: false as const, error: `尝试次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后再试`, code: "RATE_LIMITED" as const },
    429
  );
}

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const siteToken = getSiteToken(c.env);
  if (!siteToken) {
    return c.json({ error: "SUBFLARE_TOKEN is not configured", code: "NOT_CONFIGURED" }, 503);
  }
  // Bearer tokens are guessable like the login form, so they share its rate limit.
  const usesBearer = /^Bearer\s/i.test(c.req.header("authorization") ?? "");
  if (usesBearer) {
    const retryAfter = await authRetryAfter(c.env.DB, clientIp(c));
    if (retryAfter !== null) return tooManyAttempts(c, retryAfter);
  }
  if (!(await isAuthenticated(c, siteToken))) {
    if (usesBearer) await recordAuthFailure(c.env.DB, clientIp(c));
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  await next();
};
