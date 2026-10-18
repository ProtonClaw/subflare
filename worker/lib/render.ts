import { generateClashYaml } from "@subboost/core/generator";
import { buildGenerateOptionsFromConfig } from "@subboost/core/subscription/config-utils";
import type { SubBoostTemplateConfig } from "@subboost/core/types/template-config";
import type { Subscription } from "../db/repo";
import { createD1TemplateRepository } from "../db/templates-repo";
import { normalizeSourceUrl } from "./sources";

const cacheKey = (token: string) => `yaml:${token}`;

type Renderable = Pick<Subscription, "mode" | "config" | "nodes">;

function templateOptions(template: SubBoostTemplateConfig): Record<string, unknown> {
  const { schema: _schema, hiddenProxyGroups = [], enabledProxyGroups, dnsYaml, ...rest } = template;
  const hidden = new Set(hiddenProxyGroups);
  return {
    ...rest,
    enabledGroups: enabledProxyGroups.filter((id) => !hidden.has(id)),
    // An explicit empty string makes the generator drop all default base sections (DNS, sniffer, ports).
    ...(dnsYaml.trim() ? { dnsYaml } : {}),
  };
}

function toCoreConfig(sub: Renderable, template: SubBoostTemplateConfig | null): Record<string, unknown> {
  return {
    ...(template
      ? templateOptions(template)
      : {
          template: sub.config.template,
          ...(sub.config.enabledGroups ? { enabledGroups: sub.config.enabledGroups } : {}),
        }),
    sources: sub.config.sources.map((source) => ({
      id: source.id,
      type: source.type,
      content: source.type === "url" ? (normalizeSourceUrl(source.content) ?? source.content) : source.content,
      useProxyProviders: source.type === "url" && sub.mode === "provider",
    })),
  };
}

function hasProviderSources(sub: Renderable): boolean {
  return sub.mode === "provider" && sub.config.sources.some((s) => s.type === "url" && normalizeSourceUrl(s.content));
}

export function renderYaml(sub: Renderable, template: SubBoostTemplateConfig | null): string | null {
  if (sub.nodes.length === 0 && !hasProviderSources(sub)) return null;
  return generateClashYaml(buildGenerateOptionsFromConfig(toCoreConfig(sub, template), { nodes: sub.nodes }));
}

export async function loadTemplateConfig(db: D1Database, sub: Pick<Subscription, "config">) {
  if (!sub.config.templateId) return null;
  return (await createD1TemplateRepository(db).get(sub.config.templateId))?.config ?? null;
}

export async function getCachedYaml(env: Env, sub: Subscription): Promise<string | null> {
  const cached = await env.KV.get(cacheKey(sub.token));
  if (cached !== null) return cached;
  const yaml = renderYaml(sub, await loadTemplateConfig(env.DB, sub));
  if (yaml !== null) await env.KV.put(cacheKey(sub.token), yaml);
  return yaml;
}

export async function invalidateYaml(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(cacheKey(token));
}
