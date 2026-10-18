import type { PullLog } from "@/lib/api";

const regionNames = new Intl.DisplayNames("zh-CN", { type: "region" });

function flagEmoji(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) return "";
  return String.fromCodePoint(...[...country].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function countryName(country: string): string {
  try {
    return regionNames.of(country) ?? country;
  } catch {
    return country;
  }
}

export function describeLocation(log: PullLog): string | null {
  const parts = [
    log.country && `${flagEmoji(log.country)} ${countryName(log.country)}`.trim(),
    log.region,
    log.city !== log.region ? log.city : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
