import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  CalendarClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  GaugeIcon,
  HistoryIcon,
  InfoIcon,
  LayersIcon,
  LinkIcon,
  Loader2Icon,
  PartyPopperIcon,
  PencilIcon,
  RefreshCwIcon,
  RotateCcwKeyIcon,
  ServerIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { renderSVG } from "uqr";
import { Link, useLocation, useSearch } from "wouter";
import { BarChart, BigNumber, ClientShare, PageHeader, Panel, PanelTitle, ProgressBar, Segmented } from "@/components/kit";
import { PullLogList } from "@/components/pull-log-list";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeleteSubscription,
  usePullStats,
  useRefreshSubscription,
  useRotateToken,
  useSubscription,
  useTemplateName,
} from "@/hooks/use-api";
import { subscriptionUrl, type SubscriptionDetail } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { formatBytes, formatDate, formatRelative, intervalLabel } from "@/lib/format";
import { daysUntil, EXPIRY_WARN_DAYS, usageOf } from "@/lib/insights";
import { MODE_META } from "@/lib/modes";
import { sourceLabel } from "@/lib/sources";
import { cn } from "@/lib/utils";

const NODE_PREVIEW = 30;

const TABS = ["overview", "nodes", "pulls", "settings"] as const;
type Tab = (typeof TABS)[number];

const BackLink = () => (
  <Link href="/subscriptions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
    <ArrowLeftIcon className="size-4" /> 我的订阅
  </Link>
);

export function SubscriptionDetailPage({ id }: { id: string }) {
  const detail = useSubscription(id);

  if (detail.isPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-36 rounded-3xl" />
      </div>
    );
  }
  if (detail.isError) {
    return (
      <>
        <PageHeader title="订阅不存在" back={<BackLink />} />
        <Panel className="text-muted-foreground">{detail.error.message}</Panel>
      </>
    );
  }
  return <Detail sub={detail.data} now={detail.dataUpdatedAt} />;
}

function Detail({ sub, now }: { sub: SubscriptionDetail; now: number }) {
  const [, navigate] = useLocation();
  const search = new URLSearchParams(useSearch());
  const justCreated = search.has("created");
  const tab = TABS.includes(search.get("tab") as Tab) ? (search.get("tab") as Tab) : "overview";
  const [confirm, setConfirm] = useState<"delete" | "rotate" | null>(null);
  const refresh = useRefreshSubscription();
  const rotate = useRotateToken();
  const remove = useDeleteSubscription();
  const mode = MODE_META[sub.mode];
  const templateName = useTemplateName();

  const doRefresh = () =>
    refresh.mutate(sub.id, {
      onSuccess: (d) =>
        d.lastError ? toast.warning("部分来源更新失败", { description: d.lastError }) : toast.success(`已更新，${d.nodeCount} 个节点`),
      onError: (e) => toast.error(e.message),
    });

  const doConfirm = () => {
    if (confirm === "delete") {
      remove.mutate(sub.id, {
        onSuccess: () => {
          toast.success("已删除");
          navigate("/subscriptions");
        },
        onError: (e) => toast.error(e.message),
      });
    } else if (confirm === "rotate") {
      rotate.mutate(sub.id, {
        onSuccess: ({ token }) => token && copyText(subscriptionUrl(token), "链接已重置，新链接已复制"),
        onError: (e) => toast.error(e.message),
      });
    }
    setConfirm(null);
  };

  return (
    <>
      <PageHeader
        back={<BackLink />}
        title={sub.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1 rounded-full">
              <mode.icon className="size-3" /> {mode.label}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {templateName(sub.config.template, sub.config.templateId)}
            </Badge>
            {sub.note && <span className="whitespace-pre-line">{sub.note}</span>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={doRefresh} disabled={refresh.isPending}>
              {refresh.isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
              立即更新
            </Button>
            <Button asChild>
              <Link href={`/subscriptions/${sub.id}/edit`}>
                <PencilIcon /> 编辑
              </Link>
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => navigate(`/subscriptions/${sub.id}?tab=${v}`, { replace: true })} className="gap-5">
        <TabsList variant="line" className="w-full justify-start border-b pb-1">
          <TabsTrigger value="overview" className="flex-none px-3 after:bg-primary">概览</TabsTrigger>
          <TabsTrigger value="nodes" className="flex-none px-3 after:bg-primary">
            节点 <span className="text-xs text-muted-foreground tabular-nums">{sub.nodeCount}</span>
          </TabsTrigger>
          <TabsTrigger value="pulls" className="flex-none px-3 after:bg-primary">拉取记录</TabsTrigger>
          <TabsTrigger value="settings" className="flex-none px-3 after:bg-primary">设置</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-5">
          <LinkPanel sub={sub} highlight={justCreated} />
          <StatsRow sub={sub} now={now} />
          <div className="grid gap-5 xl:grid-cols-3">
            <PullsPanel sub={sub} />
            <StatusPanel sub={sub} />
          </div>
        </TabsContent>
        <TabsContent value="nodes">
          <NodesPanel sub={sub} />
        </TabsContent>
        <TabsContent value="pulls">
          <Panel>
            <PanelTitle icon={HistoryIcon} title="拉取记录" description="每次拉取的时间、IP、地区和客户端，保留 90 天。" />
            <PullLogList subscriptionId={sub.id} />
          </Panel>
        </TabsContent>
        <TabsContent value="settings" className="space-y-5">
          <SourcesPanel sub={sub} />
          <ConfigPanel sub={sub} />
          <DangerPanel onRotate={() => setConfirm("rotate")} onDelete={() => setConfirm("delete")} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? `删除「${sub.name}」？` : "重置订阅链接？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "删除后订阅链接立即失效，拉取记录也会一并删除，此操作无法撤销。"
                : "旧链接将立即失效，需要在所有客户端中更新为新链接。之后仍用旧链接拉取的请求会在拉取记录中标为「旧链接」。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={doConfirm}
              className={cn(confirm === "delete" && "bg-destructive text-white hover:bg-destructive/90")}
            >
              {confirm === "delete" ? "删除" : "重置"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function LinkPanel({ sub, highlight }: { sub: SubscriptionDetail; highlight: boolean }) {
  const url = subscriptionUrl(sub.token);
  const qr = useMemo(() => renderSVG(url, { border: 1, pixelSize: 6 }), [url]);
  const importUrl = (scheme: string) =>
    `${scheme}://install-config?url=${encodeURIComponent(url)}&name=${encodeURIComponent(sub.name)}`;

  return (
    <Panel className={cn(highlight && "ring-2 ring-primary/40")}>
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <PanelTitle
            icon={highlight ? PartyPopperIcon : LinkIcon}
            title={highlight ? "订阅已生成" : "订阅链接"}
            description="复制到 Clash Verge / Mihomo Party / Stash 等客户端，或扫码导入。请勿泄露给他人。"
          />
          <button
            type="button"
            onClick={() => copyText(url, "订阅链接已复制")}
            className="group flex w-full items-center gap-3 rounded-2xl bg-muted px-4 py-3.5 text-left font-mono text-sm transition-colors hover:bg-accent"
          >
            <span className="min-w-0 flex-1 truncate">{url}</span>
            <CopyIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
          </button>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => copyText(url, "订阅链接已复制")}>
              <CopyIcon /> 复制链接
            </Button>
            <Button variant="outline" asChild>
              <a href={importUrl("clash")}>
                <ExternalLinkIcon /> 导入 Clash
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={importUrl("stash")}>
                <ExternalLinkIcon /> 导入 Stash
              </a>
            </Button>
          </div>
        </div>
        <div className="mx-auto w-40 overflow-hidden rounded-2xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full">
          <div dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </div>
    </Panel>
  );
}

function StatsRow({ sub, now }: { sub: SubscriptionDetail; now: number }) {
  const usage = usageOf(sub.userinfo);
  const days = daysUntil(sub.userinfo?.expire, now);
  const noInfo = sub.mode === "provider" ? "客户端拉取模式下由客户端显示" : "机场未提供";

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Panel>
        <PanelTitle icon={LayersIcon} title="节点" />
        <BigNumber>{sub.nodeCount}</BigNumber>
        <p className="mt-3 text-xs text-muted-foreground">
          {sub.mode === "provider" ? "仅统计手动粘贴的节点，订阅链接中的节点由客户端拉取" : "最近一次快照中的节点"}
        </p>
      </Panel>
      <Panel>
        <PanelTitle icon={GaugeIcon} title="剩余流量" />
        <BigNumber>{!usage ? "—" : usage.total === null ? "不限量" : formatBytes(Math.max(0, usage.total - usage.used))}</BigNumber>
        {usage?.total === null ? (
          <p className="mt-3 text-xs text-muted-foreground">已用 {formatBytes(usage.used)}</p>
        ) : usage ? (
          <div className="mt-3 space-y-2">
            <ProgressBar value={usage.ratio} />
            <p className="text-xs text-muted-foreground">
              已用 {formatBytes(usage.used)} / {formatBytes(usage.total)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">{noInfo}</p>
        )}
      </Panel>
      <Panel>
        <PanelTitle icon={CalendarClockIcon} title="到期" />
        <BigNumber className={cn(days !== null && days <= EXPIRY_WARN_DAYS && "text-warning", days !== null && days <= 0 && "text-destructive")}>
          {days !== null ? (days <= 0 ? "已到期" : `${days} 天`) : sub.userinfo ? "长期有效" : "—"}
        </BigNumber>
        <p className="mt-3 text-xs text-muted-foreground">
          {sub.userinfo?.expire ? formatDate(sub.userinfo.expire) : sub.userinfo ? "机场未设置到期时间" : noInfo}
        </p>
      </Panel>
    </div>
  );
}

const RANGES = [
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天" },
] as const;

function PullsPanel({ sub }: { sub: SubscriptionDetail }) {
  const [range, setRange] = useState<"7" | "30">("7");
  const pulls = usePullStats({ days: 30, subscriptionId: sub.id });
  const days = pulls.data?.days.slice(-Number(range)) ?? [];
  const total = days.reduce((n, d) => n + d.count, 0);

  return (
    <Panel className="xl:col-span-2">
      <PanelTitle
        icon={ActivityIcon}
        title="拉取统计"
        description={pulls.data ? `近 ${range} 天共 ${total} 次` : undefined}
        action={<Segmented value={range} options={RANGES} onChange={setRange} />}
      />
      {pulls.data ? (
        <div className="space-y-6">
          <BarChart data={days} height="h-32" />
          <ClientShare clients={pulls.data.clients} total={pulls.data.total} />
        </div>
      ) : (
        <Skeleton className="h-40 w-full" />
      )}
    </Panel>
  );
}

function StatusPanel({ sub }: { sub: SubscriptionDetail }) {
  const rows: Array<[string, string]> = [
    ["最近拉取", sub.lastPulledAt ? `${formatRelative(sub.lastPulledAt)} · ${sub.lastClient}` : "尚未被客户端拉取"],
    ["最近更新", formatRelative(sub.lastRefreshedAt)],
    ["自动更新", sub.mode === "snapshot" ? intervalLabel(sub.autoUpdateInterval) : "由客户端决定"],
    ["创建于", new Date(sub.createdAt).toLocaleDateString("zh-CN")],
  ];
  return (
    <Panel>
      <PanelTitle icon={InfoIcon} title="状态" />
      <dl className="space-y-3.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {sub.lastError && (
        <div className="mt-5 flex gap-2 rounded-2xl bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">{sub.lastError}</span>
        </div>
      )}
    </Panel>
  );
}

function ConfigPanel({ sub }: { sub: SubscriptionDetail }) {
  const templateName = useTemplateName();
  const templateHref = sub.config.templateId ? `/templates/${sub.config.templateId}` : `/templates/builtin/${sub.config.template}`;
  const rows: Array<[string, ReactNode]> = [
    ["模式", MODE_META[sub.mode].label],
    [
      "模板",
      <Link key="template" href={templateHref} className="hover:underline">
        {templateName(sub.config.template, sub.config.templateId)}
      </Link>,
    ],
    ["自动更新", sub.mode === "snapshot" ? intervalLabel(sub.autoUpdateInterval) : "由客户端决定"],
    ["创建于", new Date(sub.createdAt).toLocaleDateString("zh-CN")],
  ];
  return (
    <Panel>
      <PanelTitle
        icon={SettingsIcon}
        title="配置"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/subscriptions/${sub.id}/edit`}>
              <PencilIcon /> 编辑
            </Link>
          </Button>
        }
      />
      <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 text-sm">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0 truncate">{v}</dd>
          </Fragment>
        ))}
      </dl>
    </Panel>
  );
}

function DangerPanel({ onRotate, onDelete }: { onRotate: () => void; onDelete: () => void }) {
  return (
    <Panel>
      <PanelTitle icon={AlertTriangleIcon} title="危险操作" />
      <div className="divide-y">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <div className="text-sm font-medium">重置订阅链接</div>
            <div className="text-xs text-muted-foreground">链接泄露时使用。旧链接立即失效，所有客户端需要换成新链接。</div>
          </div>
          <Button variant="outline" onClick={onRotate}>
            <RotateCcwKeyIcon /> 重置链接
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <div className="text-sm font-medium">删除订阅</div>
            <div className="text-xs text-muted-foreground">链接和拉取记录一并删除，无法撤销。</div>
          </div>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2Icon /> 删除订阅
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function SourcesPanel({ sub }: { sub: SubscriptionDetail }) {
  return (
    <Panel>
      <PanelTitle icon={ServerIcon} title="来源" description={`${sub.config.sources.length} 个`} />
      <ul className="space-y-2">
        {sub.config.sources.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm">
            <Badge variant="outline" className="shrink-0 rounded-full">
              {s.type === "url" ? "链接" : "节点"}
            </Badge>
            <span className="min-w-0 flex-1 truncate">{sourceLabel(s)}</span>
          </li>
        ))}
      </ul>
      {sub.config.userAgent && (
        <p className="mt-3 truncate text-xs text-muted-foreground" title={sub.config.userAgent}>
          抓取 User-Agent：<span className="font-mono">{sub.config.userAgent}</span>
        </p>
      )}
    </Panel>
  );
}

function NodesPanel({ sub }: { sub: SubscriptionDetail }) {
  const [showAll, setShowAll] = useState(false);
  const nodes = showAll ? sub.nodes : sub.nodes.slice(0, NODE_PREVIEW);

  return (
    <Panel>
      <PanelTitle
        icon={LayersIcon}
        title="节点"
        description={`${sub.nodeCount} 个${sub.deletedNodeCount > 0 ? `，已删除 ${sub.deletedNodeCount} 个` : ""}`}
        action={
          (sub.nodeCount > 0 || sub.deletedNodeCount > 0) && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/subscriptions/${sub.id}/nodes`}>
                <PencilIcon /> 管理节点
              </Link>
            </Button>
          )
        }
      />
      {sub.nodes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {sub.mode === "provider" ? "节点由客户端从订阅链接拉取" : "没有节点"}
        </p>
      ) : (
        <>
          <ul className="max-h-96 space-y-0.5 overflow-y-auto">
            {nodes.map((n, i) => (
              <li key={`${n.name}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-muted/60">
                <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground uppercase">{n.type}</span>
                <span className="min-w-0 flex-1 truncate" title={n.name}>
                  {n.name}
                </span>
              </li>
            ))}
          </ul>
          {sub.nodes.length > NODE_PREVIEW && (
            <Button variant="link" size="sm" className="mt-2 h-auto px-2" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "收起" : `显示全部 ${sub.nodes.length} 个`}
            </Button>
          )}
        </>
      )}
    </Panel>
  );
}
