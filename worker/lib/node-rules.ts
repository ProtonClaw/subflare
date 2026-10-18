import { REGION_PRESETS } from "@subboost/core/proxy-group-advanced";
import { makeUniqueName } from "@subboost/core/subscription/node-source-state";

// Pure module shared with the frontend preview; keep it free of Worker-only imports.

export type NodeSort = "none" | "region" | "name";

export type NodeRules = {
  /** Applied in order with JS `String.replace` (global); mirrored to mihomo `override.proxy-name` for providers. */
  rename: Array<{ pattern: string; replace: string }>;
  sort: NodeSort;
};

export const EMPTY_NODE_RULES: NodeRules = { rename: [], sort: "none" };

export function regexError(pattern: string): string | null {
  if (!pattern) return null;
  try {
    new RegExp(pattern, "g");
    return null;
  } catch {
    return "正则无效";
  }
}

const REGION_ORDER = ["hk", "tw", "jp", "sg", "kr", "us", "uk", "de", "fr", "ca", "au"];
const REGIONS = REGION_ORDER.map((id) => REGION_PRESETS.find((p) => p.id === id)?.keywords.map((k) => k.toLowerCase()) ?? []);

/** Same substring matching as the region filters of proxy groups. */
function regionRank(name: string): number {
  const lower = name.toLowerCase();
  const index = REGIONS.findIndex((keywords) => keywords.some((k) => lower.includes(k)));
  return index === -1 ? REGIONS.length : index;
}

const collator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });

export function compileRenameRules(rules: NodeRules["rename"]): Array<{ regex: RegExp; replace: string }> {
  return rules.map((rule) => ({ regex: new RegExp(rule.pattern, "g"), replace: rule.replace }));
}

/** Renames, de-duplicates and sorts nodes. Throws on an invalid pattern (validated on save). */
export function applyNodeRules<T extends { name: string }>(nodes: T[], rules: NodeRules | undefined): T[] {
  if (!rules || (rules.rename.length === 0 && rules.sort === "none")) return nodes;
  const compiled = compileRenameRules(rules.rename);
  const used = new Set<string>();
  let result = nodes.map((node) => {
    let name = node.name;
    for (const { regex, replace } of compiled) name = name.replace(regex, replace);
    name = name.trim() || node.name;
    const unique = makeUniqueName(name, used);
    used.add(unique);
    return unique === node.name ? node : { ...node, name: unique };
  });
  if (rules.sort === "name") result = [...result].sort((a, b) => collator.compare(a.name, b.name));
  if (rules.sort === "region") {
    const ranked = result.map((node) => ({ node, rank: regionRank(node.name) }));
    ranked.sort((a, b) => a.rank - b.rank || collator.compare(a.node.name, b.node.name));
    result = ranked.map((r) => r.node);
  }
  return result;
}

/** Go RE2 (mihomo) lacks lookarounds and backreferences, so such patterns only work for SubFlare-side nodes. */
export function isPortableToMihomo(pattern: string): boolean {
  return !/\(\?<?[=!]|\\[1-9]/.test(pattern);
}
