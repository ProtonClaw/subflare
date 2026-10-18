import type { PullLogEntry } from "../db/repo";
import { detectClient } from "./client";

export const PULL_LOG_RETENTION_DAYS = 90;

const clip = (value: unknown, max: number): string | null =>
  typeof value === "string" && value !== "" ? value.slice(0, max) : null;

export function describePull(request: Request): PullLogEntry {
  const cf = request.cf as IncomingRequestCfProperties | undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;
  return {
    ip: clip(request.headers.get("cf-connecting-ip"), 64),
    country: clip(cf?.country, 8),
    region: clip(cf?.region, 80),
    city: clip(cf?.city, 80),
    asn: typeof cf?.asn === "number" ? cf.asn : null,
    asOrg: clip(cf?.asOrganization, 120),
    colo: clip(cf?.colo, 8),
    client: detectClient(userAgent),
    userAgent: clip(userAgent, 512),
  };
}
