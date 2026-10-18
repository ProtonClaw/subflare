import { ArrowRightIcon, CheckCircle2Icon, PlusIcon, RssIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { BarChart, PageHeader, Panel, ProgressBar, Segmented, StatusDot } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullLogs, usePullStats, useSubscriptions } from "@/hooks/use-api";
import type { SubscriptionSummary } from "@/lib/api";
import { formatBytes, formatRelative } from "@/lib/format";
import { issuesOf, usageOf } from "@/lib/insights";
import { describeLocation } from "@/lib/pull-log";
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

const todayFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric", weekday: "short" });

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

  const days = pulls.data?.days ?? [];
  const shown = days.slice(-Number(range));
  const today = days.at(-1)?.count ?? 0;
  const delta = today - (days.at(-2)?.count ?? 0);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionTitle title="今天" extra={todayFormat.format(now)} />
        <Panel className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">拉取趋势</div>
                <div className="text-sm text-muted-foreground">
                  {pulls.data ? `近 ${range} 天共 ${shown.reduce((n, d) => n + d.count, 0)} 次` : "加载中"}
                </div>
              </div>
              <Segmented value={range} options={RANGES} onChange={setRange} />
            </div>
            {pulls.data ? <BarChart data={shown} /> : <Skeleton className="h-48 w-full" />}
          </div>
          <dl className="divide-y lg:border-l lg:pl-6">
            <Kpi label="今日拉取" value={pulls.data ? today : "—"}>
              {pulls.data && (
                <span className={cn(delta > 0 && "text-success", delta < 0 && "text-destructive")}>
                  较昨日 {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              )}
            </Kpi>
            <Kpi label="订阅 · 节点" value={`${subs.length} · ${summary.nodes}`}>
              客户端拉取 {summary.provider} · 云端快照 {summary.snapshot}
            </Kpi>
            <Kpi label="剩余流量" value={summary.total > 0 ? formatBytes(Math.max(0, summary.total - summary.used)) : "—"}>
              {summary.total > 0 ? <ProgressBar value={summary.used / summary.total} className="mt-1.5" /> : "仅云端快照模式可获取"}
            </Kpi>
            <Kpi label="今日不同 IP" value={pulls.data ? pulls.data.uniqueIpsToday : "—"}>
              来自拉取记录
            </Kpi>
          </dl>
        </Panel>
      </section>

      <section className="space-y-3">
        <SectionTitle title="近期概览" />
        <div className="grid gap-3 rounded-3xl bg-muted/70 p-3 lg:grid-cols-3">
          <RecentPulls />
          <ClientsCard clients={pulls.data?.clients} total={pulls.data?.total ?? 0} />
          <IssuesCard subs={subs} now={now} />
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, extra }: { title: string; extra?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {extra && <span className="text-sm text-muted-foreground">{extra}</span>}
    </div>
  );
}

function Kpi({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      {children && <dd className="mt-0.5 text-xs text-muted-foreground">{children}</dd>}
    </div>
  );
}

function OverviewCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Panel className="flex min-w-0 flex-col p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </Panel>
  );
}

function RecentPulls() {
  const logs = usePullLogs({}, 5);
  const items = logs.data?.pages[0]?.items ?? [];
  return (
    <OverviewCard
      title="最近拉取"
      action={
        <Link href="/pull-logs" className="text-xs text-muted-foreground hover:text-foreground">
          全部 ›
        </Link>
      }
    >
      {logs.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">客户端更新订阅后，会显示在这里</p>
      ) : (
        <ul className="divide-y text-sm">
          {items.map((log) => (
            <li key={log.id} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {log.subscriptionName ?? "已删除的订阅"}
                  {log.status === "revoked" && <span className="ml-1.5 text-xs text-destructive">旧链接</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(log.at)}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {[log.client, describeLocation(log), log.asOrg].filter(Boolean).join(" · ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

function ClientsCard({ clients, total }: { clients?: Array<{ client: string; count: number }>; total: number }) {
  return (
    <OverviewCard title="客户端 · 近 30 天">
      {!clients ? (
        <Skeleton className="h-32 w-full" />
      ) : total === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">还没有拉取数据</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {clients.slice(0, 4).map((c) => (
            <li key={c.client}>
              <div className="flex justify-between gap-2">
                <span className="truncate">{c.client}</span>
                <span className="text-muted-foreground tabular-nums">{Math.round((c.count / total) * 100)}%</span>
              </div>
              <ProgressBar value={c.count / total} className="mt-1" />
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

const REVOKED_WINDOW_MS = 7 * 86_400_000;

function IssuesCard({ subs, now }: { subs: SubscriptionSummary[]; now: number }) {
  const revoked = usePullLogs({ status: "revoked" }, 100);
  const items = useMemo(() => {
    const list: Array<{ key: string; href: string; tone: "error" | "warn"; name: string; text: string; hint?: string }> = subs.flatMap((s) =>
      issuesOf(s, now).map((issue, i) => ({ key: `${s.id}-${i}`, href: `/subscriptions/${s.id}`, tone: issue.tone, name: s.name, text: issue.text }))
    );
    const bySub = new Map<string, { name: string; count: number; ips: Set<string> }>();
    for (const log of revoked.data?.pages[0]?.items ?? []) {
      if (now - log.at > REVOKED_WINDOW_MS) continue;
      const entry = bySub.get(log.subscriptionId) ?? { name: log.subscriptionName ?? "已删除的订阅", count: 0, ips: new Set() };
      entry.count++;
      if (log.ip) entry.ips.add(log.ip);
      bySub.set(log.subscriptionId, entry);
    }
    for (const [id, e] of bySub) {
      list.push({
        key: `revoked-${id}`,
        href: `/subscriptions/${id}?tab=pulls`,
        tone: "warn",
        name: e.name,
        text: "旧链接仍在被拉取",
        hint: `近 7 天 ${e.count} 次 · ${e.ips.size} 个 IP`,
      });
    }
    return list.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "error" ? -1 : 1));
  }, [subs, now, revoked.data]);

  return (
    <OverviewCard title="需要处理" action={items.length > 0 && <span className="text-xs text-muted-foreground">{items.length} 项</span>}>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-6 text-success/70" />
          一切正常
        </div>
      ) : (
        <ul className="-mx-2 text-sm">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted">
                <StatusDot tone={item.tone} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {item.name} <span className={item.tone === "error" ? "text-destructive" : "text-warning"}>{item.text}</span>
                  </span>
                  {item.hint && <span className="block text-xs text-muted-foreground">{item.hint}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

function Welcome() {
  return (
    <Panel className="px-8 py-16 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <RssIcon className="size-6" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">欢迎使用 SubFlare</h2>
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
