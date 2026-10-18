import type { Meta, TemplateConfig } from "@/lib/api";

export type CustomGroup = TemplateConfig["customProxyGroups"][number];
export type GroupAdvanced = NonNullable<TemplateConfig["proxyGroupAdvanced"]>[string];
export type GroupType = CustomGroup["groupType"];
export type Region = NonNullable<GroupAdvanced["regions"]>[number];

export const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  select: "手动选择",
  "url-test": "自动测速",
  fallback: "故障转移",
  "load-balance": "负载均衡",
  "direct-first": "默认直连",
  "reject-first": "默认拒绝",
};

export const STRATEGY_LABEL = {
  "consistent-hashing": "一致性哈希",
  "round-robin": "轮询",
  "sticky-sessions": "粘性会话",
} as const;

export function isValidRegex(pattern: string | undefined): boolean {
  if (!pattern?.trim()) return true;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/** One-line description of a group's filters, or null when it has none. */
export function describeFilters(meta: Meta, advanced: GroupAdvanced | undefined): string | null {
  if (!advanced) return null;
  const parts: string[] = [];
  if (advanced.regions?.length) {
    parts.push(advanced.regions.map((id) => meta.regions.find((r) => r.id === id)?.label ?? id).join("、"));
  }
  if (advanced.includeRegex) parts.push(`包含 /${advanced.includeRegex}/`);
  if (advanced.excludeRegex) parts.push(`排除 /${advanced.excludeRegex}/`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function hasInvalidRegex(advanced: GroupAdvanced | undefined): boolean {
  return !isValidRegex(advanced?.includeRegex) || !isValidRegex(advanced?.excludeRegex);
}

/** Removes empty fields so an untouched group serializes to `{}`. */
export function compactAdvanced(advanced: GroupAdvanced): GroupAdvanced {
  return Object.fromEntries(
    Object.entries(advanced).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
  ) as GroupAdvanced;
}
