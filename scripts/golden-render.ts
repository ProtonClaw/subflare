// Renders a fixed set of configs and prints a hash per case, to check that generator refactors are output-identical.
// Usage: TSX_TSCONFIG_PATH=tsconfig.worker.json npx tsx scripts/golden-render.ts
import { createHash } from "node:crypto";
import { parseSubscription } from "@subboost/core/parser";
import { buildDefaultSubBoostTemplateConfig } from "@subboost/core/config/defaults";
import type { SubBoostTemplateConfig } from "@subboost/core/types/template-config";
import { renderYaml } from "../worker/lib/render";

const regions = ["香港", "日本", "美国", "新加坡", "台湾", "韩国", "英国", "Germany", "Other"];
const links = Array.from({ length: 120 }, (_, i) => {
  const name = encodeURIComponent(`${regions[i % regions.length]} ${String(i).padStart(3, "0")}`);
  return i % 2
    ? `trojan://pw${i}@n${i}.example.com:443?sni=n${i}.example.com#${name}`
    : `ss://${Buffer.from(`aes-128-gcm:pw${i}`).toString("base64")}@n${i}.example.com:${8000 + i}#${name}`;
});
const nodes = parseSubscription(links.join("\n")).nodes;
const source = { id: "s1", type: "url" as const, content: "https://example.com/sub" };

function advancedTemplate(): SubBoostTemplateConfig {
  const base = buildDefaultSubBoostTemplateConfig("full");
  return {
    ...base,
    customProxyGroups: [
      { id: "c1", name: "日美精选", emoji: "⭐", groupType: "url-test", memberSource: "filtered-nodes", advanced: { regions: ["jp", "us"], excludeRegex: "00[0-4]" } },
      { id: "c2", name: "其他地区", emoji: "🌐", groupType: "select", advanced: { regions: ["other"] } },
    ],
    proxyGroupAdvanced: {
      ai: { regions: ["us", "sg"], includeRegex: "1", extraMembers: [{ kind: "direct" }], memberOrder: [{ kind: "node", name: nodes[3].name }] },
      netflix: { excludedMembers: [{ kind: "node", name: nodes[0].name }], groupType: "load-balance" },
      youtube: { sourceIds: ["missing"] },
    },
    proxyGroupAdvancedModeEnabled: true,
    customRules: [{ id: "r1", type: "DOMAIN-SUFFIX", value: "a.example", target: { kind: "custom", id: "c1" } }],
    proxyGroupNameOverrides: { ai: "🤖 AI" },
  };
}

const cases: Array<[string, Parameters<typeof renderYaml>[0], SubBoostTemplateConfig | null]> = [
  ["minimal", { mode: "snapshot", config: { sources: [source], template: "minimal" }, nodes }, null],
  ["standard", { mode: "snapshot", config: { sources: [source], template: "standard" }, nodes }, null],
  ["full", { mode: "snapshot", config: { sources: [source], template: "full" }, nodes }, null],
  ["provider-full", { mode: "provider", config: { sources: [source], template: "full" }, nodes: [] }, null],
  ["advanced", { mode: "snapshot", config: { sources: [source], template: "full" }, nodes }, advancedTemplate()],
];

for (const [name, sub, template] of cases) {
  const yaml = renderYaml(sub, template) ?? "";
  console.log(name.padEnd(14), createHash("sha256").update(yaml).digest("hex").slice(0, 16), yaml.length);
}
