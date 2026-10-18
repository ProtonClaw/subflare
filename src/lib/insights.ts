import type { SubscriptionSummary } from "@/lib/api";

export const DAY_MS = 86_400_000;
const STALE_MS = 3 * DAY_MS;
export const EXPIRY_WARN_DAYS = 7;
export const USAGE_WARN = 0.9;

type UserInfo = SubscriptionSummary["userinfo"];

export function usageOf(info: UserInfo) {
  if (!info?.total) return null;
  const used = (info.upload ?? 0) + (info.download ?? 0);
  return { used, total: info.total, ratio: Math.min(1, used / info.total) };
}

export function daysUntil(expireSeconds: number | undefined, now: number): number | null {
  return expireSeconds ? Math.ceil((expireSeconds * 1000 - now) / DAY_MS) : null;
}

export type Issue = { tone: "error" | "warn"; text: string };

export function issuesOf(sub: SubscriptionSummary, now: number): Issue[] {
  const out: Issue[] = [];
  if (sub.lastError) out.push({ tone: "error", text: "更新失败" });
  const days = daysUntil(sub.userinfo?.expire, now);
  if (days !== null && days <= 0) out.push({ tone: "error", text: "已到期" });
  else if (days !== null && days <= EXPIRY_WARN_DAYS) out.push({ tone: "warn", text: `${days} 天后到期` });
  const usage = usageOf(sub.userinfo);
  if (usage && usage.ratio >= USAGE_WARN) out.push({ tone: "warn", text: `流量已用 ${Math.round(usage.ratio * 100)}%` });
  if (now - sub.createdAt > STALE_MS && (!sub.lastPulledAt || now - sub.lastPulledAt > STALE_MS)) {
    out.push({ tone: "warn", text: sub.lastPulledAt ? "3 天未被拉取" : "从未被客户端拉取" });
  }
  return out;
}
