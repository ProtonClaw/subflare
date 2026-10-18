import { parseSubscription } from "@subboost/core/parser";
import { tryNormalizeSubscriptionUrlInput } from "@subboost/core/subscription/url-input";
import {
  hasSubscriptionUserInfo,
  parseSubscriptionUserInfo,
  type SubscriptionUserInfo,
} from "@subboost/core/subscription/subscription-userinfo";
import type { ParsedNode } from "@subboost/core/types/node";
import type { Source, SubscriptionMode } from "../db/repo";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_USER_AGENT = "clash-verge/v2.2.3";

export type SourceReport = {
  id: string;
  type: Source["type"];
  nodeCount: number;
  fetched: boolean;
  error?: string;
};

export type CollectedNodes = {
  /** Nodes to persist: inline sources, plus fetched URL sources in snapshot mode. */
  nodes: ParsedNode[];
  allNodes: ParsedNode[];
  userinfo: SubscriptionUserInfo | null;
  sources: SourceReport[];
  /** Parsed nodes per source id; null when the source failed or was not fetched. */
  bySource: Map<string, ParsedNode[] | null>;
};

type FetchedText = { ok: true; text: string; userinfo: SubscriptionUserInfo | null } | { ok: false; error: string };

export function normalizeSourceUrl(content: string): string | null {
  const candidate = tryNormalizeSubscriptionUrlInput(content) ?? content.trim();
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchText(url: string, userAgent: string): Promise<FetchedText> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": userAgent, accept: "text/plain, application/yaml, */*;q=0.8" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return { ok: false, error: timedOut ? "请求超时" : `请求失败：${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: response.status === 403 ? "HTTP 403（订阅方可能屏蔽了 Cloudflare 出口，建议改用 Provider 模式）" : `HTTP ${response.status}`,
    };
  }
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) return { ok: false, error: "订阅内容超过 10MB" };
  const text = await response.text();
  if (text.length > MAX_BYTES) return { ok: false, error: "订阅内容超过 10MB" };

  const header = response.headers.get("subscription-userinfo");
  const userinfo = header ? parseSubscriptionUserInfo(header) : null;
  return { ok: true, text, userinfo: userinfo && hasSubscriptionUserInfo(userinfo) ? userinfo : null };
}

/**
 * Parses inline sources and, unless `fetchRemote` is false, fetches URL sources.
 * In provider mode URL sources are referenced by the client and never stored as nodes.
 */
export async function collectNodes(
  sources: Source[],
  options: { mode: SubscriptionMode; fetchRemote: boolean; userAgent?: string }
): Promise<CollectedNodes> {
  let userinfo: SubscriptionUserInfo | null = null;

  const results = await Promise.all(
    sources.map(async (source): Promise<{ report: SourceReport; nodes: ParsedNode[] }> => {
      const base = { id: source.id, type: source.type };
      if (source.type === "nodes") {
        const parsed = parseSubscription(source.content);
        const error = parsed.nodes.length === 0 ? parsed.errors[0] || "未识别到节点" : undefined;
        return { report: { ...base, nodeCount: parsed.nodes.length, fetched: false, error }, nodes: parsed.nodes };
      }

      const url = normalizeSourceUrl(source.content);
      if (!url) return { report: { ...base, nodeCount: 0, fetched: false, error: "无效的订阅 URL" }, nodes: [] };
      if (!options.fetchRemote) return { report: { ...base, nodeCount: 0, fetched: false }, nodes: [] };

      const fetched = await fetchText(url, options.userAgent || DEFAULT_USER_AGENT);
      if (!fetched.ok) return { report: { ...base, nodeCount: 0, fetched: true, error: fetched.error }, nodes: [] };
      if (fetched.userinfo && !userinfo) userinfo = fetched.userinfo;

      const parsed = parseSubscription(fetched.text);
      const error = parsed.nodes.length === 0 ? parsed.errors[0] || "未识别到节点" : undefined;
      return { report: { ...base, nodeCount: parsed.nodes.length, fetched: true, error }, nodes: parsed.nodes };
    })
  );

  const keepRemoteNodes = options.mode === "snapshot";
  const nodes = results.flatMap((r) => (r.report.type === "url" && !keepRemoteNodes ? [] : r.nodes));
  const bySource = new Map(
    results.map((r) => [r.report.id, r.report.error || (r.report.type === "url" && !r.report.fetched) ? null : r.nodes])
  );
  return { nodes, allNodes: results.flatMap((r) => r.nodes), userinfo, sources: results.map((r) => r.report), bySource };
}

export function summarizeErrors(reports: SourceReport[]): string | null {
  const failed = reports.filter((r) => r.error);
  return failed.length > 0 ? failed.map((r) => `${r.id}: ${r.error}`).join("; ") : null;
}
