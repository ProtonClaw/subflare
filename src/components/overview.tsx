import {
  ActivityIcon,
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  GaugeIcon,
  LayersIcon,
  RssIcon,
  type LucideIcon,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PullStats, SubscriptionSummary } from "@/lib/api";
import { formatBytes, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const STALE_MS = 3 * DAY_MS;
const EXPIRY_WARN_DAYS = 7;
const USAGE_WARN = 0.9;
const CLIENT_COLORS = ["bg-orange-500", "bg-rose-500", "bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-zinc-400"];

type Attention = { id: string; name: string; tone: "error" | "warn"; text: string };

function usageOf(sub: SubscriptionSummary) {
  const info = sub.userinfo;
  if (!info?.total) return null;
  return { used: (info.upload ?? 0) + (info.download ?? 0), total: info.total };
}

function collectAttention(subs: SubscriptionSummary[], now: number): Attention[] {
  const out: Attention[] = [];
  for (const s of subs) {
    if (s.lastError) out.push({ id: s.id, name: s.name, tone: "error", text: "更新失败" });
    const expire = s.userinfo?.expire;
    if (expire) {
      const days = Math.ceil((expire * 1000 - now) / DAY_MS);
      if (days <= 0) out.push({ id: s.id, name: s.name, tone: "error", text: "已到期" });
      else if (days <= EXPIRY_WARN_DAYS) out.push({ id: s.id, name: s.name, tone: "warn", text: `${days} 天后到期` });
    }
    const usage = usageOf(s);
    if (usage && usage.used / usage.total >= USAGE_WARN) {
      out.push({ id: s.id, name: s.name, tone: "warn", text: `流量已用 ${Math.round((usage.used / usage.total) * 100)}%` });
    }
    if (now - s.createdAt > STALE_MS && (!s.lastPulledAt || now - s.lastPulledAt > STALE_MS)) {
      out.push({ id: s.id, name: s.name, tone: "warn", text: s.lastPulledAt ? "3 天未被客户端拉取" : "从未被客户端拉取" });
    }
  }
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "error" ? -1 : 1));
}

type Props = {
  subs: SubscriptionSummary[];
  pulls: PullStats | undefined;
  /** Reference time for relative checks (when `subs` was fetched). */
  now: number;
};

export function Overview({ subs, pulls, now }: Props) {
  const summary = useMemo(() => {
    const snapshot = subs.filter((s) => s.mode === "snapshot").length;
    const nodes = subs.reduce((n, s) => n + s.nodeCount, 0);
    let used = 0;
    let total = 0;
    for (const s of subs) {
      const u = usageOf(s);
      if (u) {
        used += u.used;
        total += u.total;
      }
    }
    const nextExpiry = subs
      .filter((s) => s.userinfo?.expire && s.userinfo.expire * 1000 > now)
      .sort((a, b) => a.userinfo!.expire! - b.userinfo!.expire!)[0];
    return { snapshot, provider: subs.length - snapshot, nodes, used, total, nextExpiry };
  }, [subs, now]);
  const attention = useMemo(() => collectAttention(subs, now), [subs, now]);

  const expireDays = summary.nextExpiry
    ? Math.ceil((summary.nextExpiry.userinfo!.expire! * 1000 - now) / DAY_MS)
    : null;

  return (
    <section className="mb-10 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard icon={RssIcon} label="订阅" value={subs.length}>
          客户端拉取 {summary.provider} · 云端快照 {summary.snapshot}
        </StatCard>
        <StatCard icon={LayersIcon} label="节点" value={summary.nodes}>
          {summary.provider > 0 ? "不含客户端拉取的节点" : "全部快照节点"}
        </StatCard>
        <StatCard
          icon={GaugeIcon}
          label="剩余流量"
          value={summary.total > 0 ? formatBytes(Math.max(0, summary.total - summary.used)) : "—"}
          extra={summary.total > 0 ? <Ring value={summary.used / summary.total} /> : null}
        >
          {summary.total > 0 ? `共 ${formatBytes(summary.total)}` : "快照模式订阅才有流量信息"}
        </StatCard>
        <StatCard
          icon={CalendarClockIcon}
          label="最近到期"
          value={expireDays !== null ? `${expireDays} 天` : "—"}
          tone={expireDays !== null && expireDays <= EXPIRY_WARN_DAYS ? "warn" : undefined}
        >
          {summary.nextExpiry
            ? `${summary.nextExpiry.name} · ${formatDate(summary.nextExpiry.userinfo!.expire!)}`
            : "暂无到期信息"}
        </StatCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        <PullChart pulls={pulls} subs={subs} />
        <AttentionPanel items={attention} />
      </div>
    </section>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border bg-card/70 p-5 shadow-sm backdrop-blur", className)}>{children}</div>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  extra,
  tone,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  extra?: ReactNode;
  tone?: "warn";
  children: ReactNode;
}) {
  return (
    <Panel className="relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
            tone === "warn" && "text-amber-600 dark:text-amber-400"
          )}
        >
          {value}
        </div>
        {extra}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{children}</div>
    </Panel>
  );
}

function Ring({ value }: { value: number }) {
  const pct = Math.min(1, Math.max(0, value));
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <svg viewBox="0 0 36 36" className="size-10 shrink-0 -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${pct * c} ${c}`}
            className={pct >= USAGE_WARN ? "stroke-rose-500" : "stroke-primary"}
          />
        </svg>
      </TooltipTrigger>
      <TooltipContent>已用 {Math.round(pct * 100)}%</TooltipContent>
    </Tooltip>
  );
}

function PullChart({ pulls, subs }: { pulls: PullStats | undefined; subs: SubscriptionSummary[] }) {
  const lastPull = subs.reduce<SubscriptionSummary | null>(
    (latest, s) => (s.lastPulledAt && (!latest || s.lastPulledAt > latest.lastPulledAt!) ? s : latest),
    null
  );

  if (!pulls) {
    return (
      <Panel className="lg:col-span-2">
        <Skeleton className="h-44 w-full" />
      </Panel>
    );
  }

  const max = Math.max(1, ...pulls.days.map((d) => d.count));
  const topClients = pulls.clients.slice(0, CLIENT_COLORS.length - 1);
  const otherCount = pulls.clients.slice(CLIENT_COLORS.length - 1).reduce((n, c) => n + c.count, 0);
  const legend = otherCount > 0 ? [...topClients, { client: "其他", count: otherCount }] : topClients;

  return (
    <Panel className="lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ActivityIcon className="size-4 text-primary" />
          近 7 天拉取
          <span className="text-muted-foreground tabular-nums">{pulls.total} 次</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {lastPull ? `最近：${lastPull.name} · ${formatRelative(lastPull.lastPulledAt)} · ${lastPull.lastClient}` : "还没有客户端拉取过订阅"}
        </div>
      </div>

      <div className="mt-5 flex h-28 items-end gap-2 sm:gap-3">
        {pulls.days.map((d, i) => {
          const isToday = i === pulls.days.length - 1;
          return (
            <Tooltip key={d.day}>
              <TooltipTrigger asChild>
                <div className="flex h-full flex-1 flex-col justify-end">
                  <div
                    className={cn(
                      "w-full rounded-md transition-all",
                      d.count > 0
                        ? isToday
                          ? "bg-gradient-to-t from-orange-500 to-rose-500"
                          : "bg-primary/40 hover:bg-primary/60"
                        : "bg-muted"
                    )}
                    style={{ height: d.count > 0 ? `${Math.max(8, (d.count / max) * 100)}%` : "4px" }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {d.day.slice(5)} · {d.count} 次
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {pulls.days.map((d, i) => (
          <div key={d.day} className="flex-1 text-center text-[10px] text-muted-foreground tabular-nums">
            {i === pulls.days.length - 1 ? "今天" : d.day.slice(5).replace("-", "/")}
          </div>
        ))}
      </div>

      {legend.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {legend.map((c, i) => (
              <div key={c.client} className={CLIENT_COLORS[i]} style={{ width: `${(c.count / pulls.total) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {legend.map((c, i) => (
              <div key={c.client} className="flex items-center gap-1.5 text-xs">
                <span className={cn("size-2 rounded-full", CLIENT_COLORS[i])} />
                {c.client}
                <span className="text-muted-foreground tabular-nums">{Math.round((c.count / pulls.total) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function AttentionPanel({ items }: { items: Attention[] }) {
  return (
    <Panel className="flex flex-col">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangleIcon className={cn("size-4", items.length > 0 ? "text-amber-500" : "text-muted-foreground")} />
        需要处理
        {items.length > 0 && <span className="text-muted-foreground tabular-nums">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-8 text-emerald-500/70" />
          一切正常
        </div>
      ) : (
        <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
          {items.map((item, i) => (
            <li key={`${item.id}-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span
                className={cn("size-1.5 shrink-0 rounded-full", item.tone === "error" ? "bg-rose-500" : "bg-amber-500")}
              />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span
                className={cn(
                  "shrink-0 text-xs",
                  item.tone === "error" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                )}
              >
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
