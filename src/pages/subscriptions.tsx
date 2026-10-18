import { ArrowDownIcon, ArrowUpIcon, CopyIcon, PlusIcon, RssIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { PageHeader, Panel, StatusDot } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscriptions, useTemplateName } from "@/hooks/use-api";
import { subscriptionUrl, type SubscriptionSummary } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { formatBytes, formatRelative } from "@/lib/format";
import { issuesOf, usageOf } from "@/lib/insights";
import { MODE_META } from "@/lib/modes";
import { cn } from "@/lib/utils";

type SortKey = "name" | "nodes" | "remaining" | "pulled" | "status";
type Sort = { key: SortKey; dir: 1 | -1 } | null;

const ISSUE_RANK = { error: 2, warn: 1 } as const;

function sortValue(sub: SubscriptionSummary, key: SortKey, now: number): string | number {
  switch (key) {
    case "name":
      return sub.name;
    case "nodes":
      return sub.nodeCount;
    case "remaining": {
      const usage = usageOf(sub.userinfo);
      return usage ? usage.total - usage.used : -1;
    }
    case "pulled":
      return sub.lastPulledAt ?? 0;
    case "status": {
      const issue = issuesOf(sub, now)[0];
      return issue ? ISSUE_RANK[issue.tone] : 0;
    }
  }
}

function sortSubs(subs: SubscriptionSummary[], sort: Sort, now: number): SubscriptionSummary[] {
  if (!sort) return subs;
  return [...subs].sort((a, b) => {
    const va = sortValue(a, sort.key, now);
    const vb = sortValue(b, sort.key, now);
    const cmp = typeof va === "string" ? va.localeCompare(vb as string, "zh-CN") : va - (vb as number);
    return cmp * sort.dir;
  });
}

export function SubscriptionsPage() {
  const subs = useSubscriptions();

  return (
    <>
      <PageHeader
        title="我的订阅"
        description="点击订阅查看链接、流量和拉取记录。"
        actions={
          <Button asChild>
            <Link href="/subscriptions/new">
              <PlusIcon /> 新建订阅
            </Link>
          </Button>
        }
      />
      {subs.isPending ? (
        <Panel className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </Panel>
      ) : subs.isError ? (
        <Panel className="text-destructive">加载失败：{subs.error.message}</Panel>
      ) : subs.data.length === 0 ? (
        <Panel className="py-16 text-center">
          <RssIcon className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-4 text-muted-foreground">还没有订阅</p>
          <Button asChild className="mt-6">
            <Link href="/subscriptions/new">
              <PlusIcon /> 新建订阅
            </Link>
          </Button>
        </Panel>
      ) : (
        <SubscriptionTable subs={subs.data} now={subs.dataUpdatedAt} />
      )}
    </>
  );
}

function SubscriptionTable({ subs, now }: { subs: SubscriptionSummary[]; now: number }) {
  const [sort, setSort] = useState<Sort>(null);
  const [, navigate] = useLocation();
  const templateName = useTemplateName();
  const rows = sortSubs(subs, sort, now);

  const toggle = (key: SortKey) =>
    setSort((s) => {
      const first = key === "name" ? 1 : -1;
      if (s?.key !== key) return { key, dir: first };
      return s.dir === first ? { key, dir: -first as 1 | -1 } : null;
    });

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={cn("px-4 py-2.5 font-medium", className)} aria-sort={sort?.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => toggle(key)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", sort?.key === key && "text-foreground")}
      >
        {label}
        {sort?.key === key && (sort.dir === 1 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr className="border-b">
            {header("name", "名称", "w-[34%]")}
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">模式</th>
            {header("nodes", "节点", "hidden text-right sm:table-cell")}
            {header("remaining", "剩余流量", "hidden text-right lg:table-cell")}
            {header("pulled", "最近拉取", "hidden lg:table-cell")}
            {header("status", "状态")}
            <th className="w-12 px-2 py-2.5">
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((sub) => {
            const mode = MODE_META[sub.mode];
            const issue = issuesOf(sub, now)[0];
            const usage = usageOf(sub.userinfo);
            return (
              <tr
                key={sub.id}
                onClick={() => navigate(`/subscriptions/${sub.id}`)}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <td className="max-w-0 px-4 py-3">
                  <Link href={`/subscriptions/${sub.id}`} className="block truncate font-medium" onClick={(e) => e.stopPropagation()}>
                    {sub.name}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {templateName(sub.template, sub.templateId)} · {sub.sourceCount} 个来源
                  </div>
                </td>
                <td className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <mode.icon className="size-3.5" /> {mode.label}
                  </span>
                </td>
                <Cell className="hidden text-right tabular-nums sm:table-cell">
                  {sub.mode === "provider" && sub.nodeCount === 0 ? "—" : sub.nodeCount}
                </Cell>
                <Cell className="hidden text-right tabular-nums lg:table-cell">
                  {usage ? formatBytes(Math.max(0, usage.total - usage.used)) : "—"}
                </Cell>
                <Cell className="hidden lg:table-cell">
                  {sub.lastPulledAt ? (
                    <>
                      {formatRelative(sub.lastPulledAt)}
                      <span className="text-muted-foreground"> · {sub.lastClient}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">尚未被拉取</span>
                  )}
                </Cell>
                <Cell>
                  <span className="inline-flex items-center gap-2">
                    <StatusDot tone={issue ? issue.tone : "ok"} />
                    <span className={issue ? (issue.tone === "error" ? "text-destructive" : "text-warning") : "text-muted-foreground"}>
                      {issue ? issue.text : "正常"}
                    </span>
                  </span>
                </Cell>
                <td className="px-2 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="复制订阅链接"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(subscriptionUrl(sub.token), "订阅链接已复制");
                    }}
                  >
                    <CopyIcon />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ className, children }: { className?: string; children: ReactNode }) {
  return <td className={cn("px-4 py-3 whitespace-nowrap", className)}>{children}</td>;
}
