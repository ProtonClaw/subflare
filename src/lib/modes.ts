import { CloudIcon, ZapIcon } from "lucide-react";

export const MODE_META = {
  provider: { label: "客户端拉取", icon: ZapIcon, hint: "客户端直接从机场更新节点，最稳定" },
  snapshot: { label: "云端快照", icon: CloudIcon, hint: "由 Cloudflare 抓取并解析节点" },
} as const;

export const TEMPLATE_LABEL = { minimal: "精简", standard: "标准", full: "完整" } as const;
