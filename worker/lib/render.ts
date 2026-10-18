import { generateClashYaml } from "@subboost/core/generator";
import { buildGenerateOptionsFromConfig } from "@subboost/core/subscription/config-utils";
import type { SubBoostTemplateConfig } from "@subboost/core/types/template-config";
import type { Subscription } from "../db/repo";
import { createD1TemplateRepository } from "../db/templates-repo";
import { applyNodeRules, isPortableToMihomo, type NodeRules } from "./node-rules";
import { normalizeSourceUrl } from "./sources";

type GenerateOptions = ReturnType<typeof buildGenerateOptionsFromConfig>;

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

/** Lets the client apply portable rename rules to nodes it pulls through proxy-providers. */
function withProviderRenames(options: GenerateOptions, rules: NodeRules | undefined): GenerateOptions {
  const portable = (rules?.rename ?? []).filter((rule) => isPortableToMihomo(rule.pattern));
  if (!options.proxyProviders || portable.length === 0) return options;
  const proxyName = portable.map((rule) => ({ pattern: rule.pattern, target: rule.replace }));
  const proxyProviders = Object.fromEntries(
    Object.entries(options.proxyProviders).map(([name, provider]) => [
      name,
      { ...(provider as Record<string, unknown>), override: { "proxy-name": proxyName } },
    ])
  );
  return { ...options, proxyProviders };
}

export function renderYaml(sub: Renderable, template: SubBoostTemplateConfig | null): string | null {
  if (sub.nodes.length === 0 && !hasProviderSources(sub)) return null;
  const rules = sub.config.nodeRules;
  const options = buildGenerateOptionsFromConfig(toCoreConfig(sub, template), { nodes: applyNodeRules(sub.nodes, rules) });
  return generateClashYaml(withProviderRenames(options, rules));
}

export async function loadTemplateConfig(db: D1Database, sub: Pick<Subscription, "config">) {
  if (!sub.config.templateId) return null;
  return (await createD1TemplateRepository(db).get(sub.config.templateId))?.config ?? null;
}

export async function getCachedYaml(env: Env, sub: Subscription): Promise<string | null> {
  const cached = await env.KV.get(cacheKey(sub.token));
  if (cached !== null) return cached;
  const yaml = renderYaml(sub, await loadTemplateConfig(env.DB, sub));
  if (yaml !== null) {
    // Free plan caps KV writes per day; a failed cache write must not fail the pull.
    await env.KV.put(cacheKey(sub.token), yaml).catch((error: unknown) => console.warn("yaml cache put failed", error));
  }
  return yaml;
}

export async function invalidateYaml(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(cacheKey(token));
}
