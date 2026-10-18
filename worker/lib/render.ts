import { generateClashYaml } from "@subboost/core/generator";
import { buildGenerateOptionsFromConfig } from "@subboost/core/subscription/config-utils";
import type { Subscription } from "../db/repo";
import { normalizeSourceUrl } from "./sources";

const cacheKey = (token: string) => `yaml:${token}`;

function toCoreConfig(sub: Pick<Subscription, "mode" | "config">): Record<string, unknown> {
  return {
    template: sub.config.template,
    ...(sub.config.enabledGroups ? { enabledGroups: sub.config.enabledGroups } : {}),
    sources: sub.config.sources.map((source) => ({
      id: source.id,
      type: source.type,
      content: source.type === "url" ? (normalizeSourceUrl(source.content) ?? source.content) : source.content,
      useProxyProviders: source.type === "url" && sub.mode === "provider",
    })),
  };
}

function hasProviderSources(sub: Pick<Subscription, "mode" | "config">): boolean {
  return sub.mode === "provider" && sub.config.sources.some((s) => s.type === "url" && normalizeSourceUrl(s.content));
}

export function renderYaml(sub: Pick<Subscription, "mode" | "config" | "nodes">): string | null {
  if (sub.nodes.length === 0 && !hasProviderSources(sub)) return null;
  return generateClashYaml(buildGenerateOptionsFromConfig(toCoreConfig(sub), { nodes: sub.nodes }));
}

export async function getCachedYaml(kv: KVNamespace, sub: Subscription): Promise<string | null> {
  const cached = await kv.get(cacheKey(sub.token));
  if (cached !== null) return cached;
  const yaml = renderYaml(sub);
  if (yaml !== null) await kv.put(cacheKey(sub.token), yaml);
  return yaml;
}

export async function invalidateYaml(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(cacheKey(token));
}
