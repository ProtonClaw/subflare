const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${UNITS[i]}`;
}

const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

export function formatRelative(ms: number | null | undefined): string {
  if (!ms) return "从未";
  const diff = (ms - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "刚刚";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 30 * 86400) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(ms).toLocaleDateString("zh-CN");
}

export function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString("zh-CN");
}

export const INTERVAL_OPTIONS = [
  { value: "off", label: "不自动更新" },
  { value: String(1800), label: "每 30 分钟" },
  { value: String(3600), label: "每 1 小时" },
  { value: String(6 * 3600), label: "每 6 小时" },
  { value: String(12 * 3600), label: "每 12 小时" },
  { value: String(86400), label: "每天" },
] as const;

export function intervalLabel(seconds: number | null): string {
  return INTERVAL_OPTIONS.find((o) => o.value === String(seconds))?.label ?? (seconds ? `每 ${Math.round(seconds / 60)} 分钟` : "手动");
}
