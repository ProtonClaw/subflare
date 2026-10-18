import {
  ActivityIcon,
  ArrowRightIcon,
  BellIcon,
  CheckCircle2Icon,
  GaugeIcon,
  LayersIcon,
  PlusIcon,
  RssIcon,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { BarChart, BigNumber, ClientShare, PageHeader, Panel, PanelTitle, ProgressBar, Segmented, StatusDot } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullStats, useSubscriptions } from "@/hooks/use-api";
import type { SubscriptionSummary } from "@/lib/api";
import { formatBytes, formatRelative } from "@/lib/format";
import { issuesOf, usageOf } from "@/lib/insights";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天" },
] as const;

export function DashboardPage() {
  const subs = useSubscriptions();

  return (
    <>
      <PageHeader
        title="仪表盘"
        description="订阅的整体状况一目了然。"
        actions={
          <Button asChild>
            <Link href="/subscriptions/new">
              <PlusIcon /> 新建订阅
            </Link>
          </Button>
        }
      />
      {subs.isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : subs.isError ? (
        <Panel className="text-destructive">加载失败：{subs.error.message}</Panel>
      ) : subs.data.length === 0 ? (
        <Welcome />
      ) : (
        <Overview subs={subs.data} now={subs.dataUpdatedAt} />
      )}
    </>
  );
}

function Overview({ subs, now }: { subs: SubscriptionSummary[]; now: number }) {
  const [range, setRange] = useState<"7" | "30">("7");
  const pulls = usePullStats({ days: 30 });

  const summary = useMemo(() => {
    const snapshot = subs.filter((s) => s.mode === "snapshot").length;
    let used = 0;
    let total = 0;
    for (const s of subs) {
      const u = usageOf(s.userinfo);
      if (u) {
        used += u.used;
        total += u.total;
      }
    }
    return { snapshot, provider: subs.length - snapshot, nodes: subs.reduce((n, s) => n + s.nodeCount, 0), used, total };
  }, [subs]);

  const issues = useMemo(
    () =>
      subs
        .flatMap((s) => issuesOf(s, now).map((issue) => ({ ...issue, sub: s })))
        .sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "error" ? -1 : 1)),
    [subs, now]
  );

  const days = pulls.data?.days ?? [];
  const today = days.at(-1)?.count ?? 0;
  const week = days.slice(-7).reduce((n, d) => n + d.count, 0);
  const month = pulls.data?.total ?? 0;
  const lastPull = subs.reduce<SubscriptionSummary | null>(
    (latest, s) => (s.lastPulledAt && (!latest || s.lastPulledAt > (latest.lastPulledAt ?? 0)) ? s : latest),
    null
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={RssIcon} label="订阅" value={subs.length}>
          客户端拉取 {summary.provider} · 云端快照 {summary.snapshot}
        </StatCard>
        <StatCard icon={LayersIcon} label="节点" value={summary.nodes}>
          {summary.provider > 0 ? "不含客户端自行拉取的节点" : "全部为云端快照节点"}
        </StatCard>
        <StatCard
          icon={GaugeIcon}
          label="剩余流量"
          value={summary.total > 0 ? formatBytes(Math.max(0, summary.total - summary.used)) : "—"}
        >
          {summary.total > 0 ? (
            <div className="space-y-2">
              <ProgressBar value={summary.used / summary.total} />
              <div>
                已用 {formatBytes(summary.used)} / {formatBytes(summary.total)}
              </div>
            </div>
          ) : (
            "云端快照模式才能获取流量信息"
          )}
        </StatCard>
        <StatCard icon={ActivityIcon} label="今日拉取" value={pulls.data ? today : "—"}>
          <div className="flex justify-between">
            <span>近 7 天 {week}</span>
            <span>近 30 天 {month}</span>
          </div>
        </StatCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelTitle
            icon={ActivityIcon}
            title="拉取趋势"
            description={
              lastPull
                ? `最近一次：${lastPull.name}，${formatRelative(lastPull.lastPulledAt)}，${lastPull.lastClient}`
                : "客户端更新订阅后，这里会显示拉取记录。"
            }
            action={<Segmented value={range} options={RANGES} onChange={setRange} />}
          />
          {pulls.data ? (
            <div className="space-y-6">
              <BarChart data={days.slice(-Number(range))} />
              {pulls.data.total > 0 && (
                <div>
                  <div className="mb-3 text-xs text-muted-foreground">客户端分布 · 近 30 天</div>
                  <ClientShare clients={pulls.data.clients} total={pulls.data.total} />
                </div>
              )}
            </div>
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Panel>

        <Panel className="flex flex-col">
          <PanelTitle icon={BellIcon} title="需要处理" description={issues.length > 0 ? `${issues.length} 项` : undefined} />
          {issues.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
              <CheckCircle2Icon className="size-9 text-success/70" />
              一切正常
            </div>
          ) : (
            <ul className="-mx-2 space-y-1">
              {issues.map((issue, i) => (
                <li key={`${issue.sub.id}-${i}`}>
                  <Link
                    href={`/subscriptions/${issue.sub.id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted"
                  >
                    <StatusDot tone={issue.tone} />
                    <span className="min-w-0 flex-1 truncate">{issue.sub.name}</span>
                    <span
                      className={cn("shrink-0 text-sm", issue.tone === "error" ? "text-destructive" : "text-warning")}
                    >
                      {issue.text}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel className="flex flex-col">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <BigNumber className="mt-3">{value}</BigNumber>
      <div className="mt-auto pt-4 text-xs text-muted-foreground">{children}</div>
    </Panel>
  );
}

function Welcome() {
  return (
    <Panel className="px-8 py-16 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <RssIcon className="size-6" />
        </div>
        <h2 className="mt-6 font-display text-2xl font-semibold">欢迎使用 SubFlare</h2>
        <p className="mt-3 text-muted-foreground">
          粘贴机场订阅链接或节点，选一个规则模板，就能得到一条可直接导入 Clash Verge / Mihomo 的订阅链接。
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/subscriptions/new">
            创建第一个订阅 <ArrowRightIcon />
          </Link>
        </Button>
      </div>
    </Panel>
  );
}
