// Usage: TSX_TSCONFIG_PATH=tsconfig.worker.json npx tsx scripts/bench-render.ts [nodeCount] [template]
import { parseSubscription } from "@subboost/core/parser";
import { renderYaml } from "../worker/lib/render";

const count = Number(process.argv[2] ?? 300);
const template = (process.argv[3] ?? "full") as "minimal" | "standard" | "full";
const regions = ["香港", "日本", "美国", "新加坡", "台湾", "韩国", "英国", "德国"];

const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

function link(i: number): string {
  const name = encodeURIComponent(`${regions[i % regions.length]} ${String(i).padStart(3, "0")} | 1x`);
  const host = `node${i}.example.com`;
  switch (i % 5) {
    case 0:
      return `ss://${btoa(`aes-256-gcm:pw${i}`)}@${host}:${10000 + i}#${name}`;
    case 1:
      return `trojan://pw${i}@${host}:443?sni=${host}&type=ws&path=%2Fws#${name}`;
    case 2:
      return `vless://${crypto.randomUUID()}@${host}:443?security=reality&sni=www.apple.com&fp=chrome&pbk=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ&sid=0123abcd&type=tcp&flow=xtls-rprx-vision#${name}`;
    case 3:
      return `hysteria2://pw${i}@${host}:8443?sni=${host}&obfs=salamander&obfs-password=x#${name}`;
    default:
      return `vmess://${b64(JSON.stringify({ v: "2", ps: decodeURIComponent(name), add: host, port: "443", id: crypto.randomUUID(), aid: "0", net: "ws", type: "none", host, path: "/v", tls: "tls" }))}`;
  }
}

const subscriptionBody = b64(Array.from({ length: count }, (_, i) => link(i)).join("\n"));

function time<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const value = fn();
  return [value, performance.now() - start];
}

const [parsed, parseCold] = time(() => parseSubscription(subscriptionBody));
const sub = {
  mode: "snapshot" as const,
  config: { sources: [{ id: "s1", type: "url" as const, content: "https://example.com/sub" }], template },
  nodes: parsed.nodes,
};
const [yaml, renderCold] = time(() => renderYaml(sub, null));

const warm = (fn: () => unknown, n = 20) => {
  const [, total] = time(() => {
    for (let i = 0; i < n; i++) fn();
  });
  return total / n;
};

console.log(
  JSON.stringify(
    {
      nodes: parsed.nodes.length,
      errors: parsed.errors.length,
      template,
      yamlKB: Math.round((yaml?.length ?? 0) / 1024),
      parseColdMs: +parseCold.toFixed(1),
      renderColdMs: +renderCold.toFixed(1),
      parseWarmMs: +warm(() => parseSubscription(subscriptionBody)).toFixed(1),
      renderWarmMs: +warm(() => renderYaml(sub, null)).toFixed(1),
    },
    null,
    2
  )
);
