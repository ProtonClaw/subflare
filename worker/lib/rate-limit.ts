import { drizzle } from "drizzle-orm/d1";
import { eq, lte, sql } from "drizzle-orm";
import { authFailures } from "../db/schema";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;

/** Seconds until `ip` may try again, or null when it is not locked out. */
export async function authRetryAfter(db: D1Database, ip: string, now = Date.now()): Promise<number | null> {
  const row = await drizzle(db).select().from(authFailures).where(eq(authFailures.ip, ip)).get();
  if (!row || row.resetAt <= now || row.count < MAX_FAILURES) return null;
  return Math.ceil((row.resetAt - now) / 1000);
}

export async function recordAuthFailure(db: D1Database, ip: string, now = Date.now()): Promise<void> {
  const resetAt = now + WINDOW_MS;
  await drizzle(db)
    .insert(authFailures)
    .values({ ip, count: 1, resetAt })
    .onConflictDoUpdate({
      target: authFailures.ip,
      set: {
        count: sql`CASE WHEN ${authFailures.resetAt} <= ${now} THEN 1 ELSE ${authFailures.count} + 1 END`,
        resetAt: sql`CASE WHEN ${authFailures.resetAt} <= ${now} THEN ${resetAt} ELSE ${authFailures.resetAt} END`,
      },
    });
}

export async function clearAuthFailures(db: D1Database, ip: string): Promise<void> {
  await drizzle(db).delete(authFailures).where(eq(authFailures.ip, ip));
}

export async function pruneAuthFailures(db: D1Database, now = Date.now()): Promise<void> {
  await drizzle(db).delete(authFailures).where(lte(authFailures.resetAt, now));
}
