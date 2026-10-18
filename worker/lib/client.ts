// Order matters: more specific patterns first (e.g. Clash Verge UAs also contain "mihomo").
const CLIENT_PATTERNS: Array<[RegExp, string]> = [
  [/clash[-_ ]?verge/i, "Clash Verge"],
  [/mihomo[-_ ]?party/i, "Mihomo Party"],
  [/flclash/i, "FlClash"],
  [/clash[-_ ]?meta[-_ ]?for[-_ ]?android|cmfa/i, "Clash Meta Android"],
  [/clashx/i, "ClashX"],
  [/stash/i, "Stash"],
  [/shadowrocket/i, "Shadowrocket"],
  [/sing-?box|\bSF[AIMT]\b/i, "sing-box"],
  [/surge/i, "Surge"],
  [/quantumult/i, "Quantumult X"],
  [/loon/i, "Loon"],
  [/mihomo|clash\.meta|clash-meta/i, "Mihomo"],
  [/clash/i, "Clash"],
  [/curl|wget|httpie|python-requests|go-http-client/i, "命令行"],
  [/mozilla|chrome|safari|firefox/i, "浏览器"],
];

export function detectClient(userAgent: string | undefined): string {
  if (!userAgent) return "未知";
  for (const [pattern, name] of CLIENT_PATTERNS) {
    if (pattern.test(userAgent)) return name;
  }
  return "其他";
}
