import { Loader2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullLogs } from "@/hooks/use-api";
import type { PullLogFilters } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { describeLocation } from "@/lib/pull-log";

type Status = NonNullable<PullLogFilters["status"]>;

const STATUS_LABEL: Record<Status, string> = { ok: "成功", empty: "无可用节点", revoked: "旧链接" };

export function PullLogList({
  subscriptionId,
  subscriptions,
}: {
  subscriptionId?: string;
  /** When given, logs from all subscriptions are listed with a subscription filter. */
  subscriptions?: Array<{ id: string; name: string }>;
}) {
  const [filters, setFilters] = useState<PullLogFilters>(subscriptionId ? { subscriptionId } : {});
  const logs = usePullLogs(filters);
  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];
  const set = (patch: Partial<PullLogFilters>) => {
    const next = { ...filters, ...patch };
    for (const key of Object.keys(next) as Array<keyof PullLogFilters>) if (next[key] === undefined) delete next[key];
    setFilters(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {subscriptions && (
          <Select value={filters.subscriptionId ?? "all"} onValueChange={(v) => set({ subscriptionId: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部订阅</SelectItem>
              {subscriptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filters.status ?? "all"} onValueChange={(v) => set({ status: v === "all" ? undefined : (v as Status) })}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部结果</SelectItem>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.ip && <FilterChip label={`IP ${filters.ip}`} onClear={() => set({ ip: undefined })} />}
        {filters.client && <FilterChip label={`客户端 ${filters.client}`} onClear={() => set({ client: undefined })} />}
        {!filters.ip && !filters.client && <span className="text-xs text-muted-foreground">点击 IP 或客户端可筛选</span>}
      </div>

      {logs.isPending ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : logs.isError ? (
        <p className="text-sm text-destructive">{logs.error.message}</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 py-8 text-center text-sm text-muted-foreground">暂无拉取记录</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl bg-muted/40">
          {items.map((log) => (
            <li key={log.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDateTime(log.at)}</span>
                {log.status !== "ok" && (
                  <Badge variant={log.status === "revoked" ? "destructive" : "secondary"}>{STATUS_LABEL[log.status]}</Badge>
                )}
                {subscriptions && !filters.subscriptionId && (
                  <span className="font-medium">{log.subscriptionName ?? "已删除的订阅"}</span>
                )}
                <button type="button" className="font-medium hover:underline" onClick={() => set({ client: log.client })}>
                  {log.client}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                {log.ip ? (
                  <button type="button" className="font-mono text-foreground hover:underline" onClick={() => set({ ip: log.ip! })}>
                    {log.ip}
                  </button>
                ) : (
                  <span>IP 未知</span>
                )}
                {describeLocation(log) && <span>{describeLocation(log)}</span>}
                {log.asOrg && (
                  <span>
                    {log.asOrg}
                    {log.asn !== null && <span className="ml-1 text-xs">AS{log.asn}</span>}
                  </span>
                )}
                {log.colo && <span className="text-xs">经 {log.colo}</span>}
              </div>
              {log.userAgent && (
                <div className="truncate font-mono text-xs text-muted-foreground/80" title={log.userAgent}>
                  {log.userAgent}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {logs.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => logs.fetchNextPage()} disabled={logs.isFetchingNextPage}>
            {logs.isFetchingNextPage && <Loader2Icon className="animate-spin" />}
            加载更多
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-sm text-accent-foreground">
      {label}
      <button type="button" aria-label="清除筛选" className="rounded-full p-0.5 hover:bg-background/60" onClick={onClear}>
        <XIcon className="size-3.5" />
      </button>
    </span>
  );
}
