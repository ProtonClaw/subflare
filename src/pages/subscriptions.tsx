import { ChevronRightIcon, CopyIcon, PlusIcon, RssIcon } from "lucide-react";
import { Link } from "wouter";
import { PageHeader, Panel, StatusDot } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscriptions, useTemplateName } from "@/hooks/use-api";
import { subscriptionUrl, type SubscriptionSummary } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { formatRelative } from "@/lib/format";
import { issuesOf } from "@/lib/insights";
import { MODE_META } from "@/lib/modes";

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
            <Skeleton key={i} className="h-16 rounded-2xl" />
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
        <Panel className="p-2 sm:p-3">
          <ul className="divide-y divide-border/70">
            {subs.data.map((sub) => (
              <Row key={sub.id} sub={sub} now={subs.dataUpdatedAt} />
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function Row({ sub, now }: { sub: SubscriptionSummary; now: number }) {
  const mode = MODE_META[sub.mode];
  const issue = issuesOf(sub, now)[0];
  const templateName = useTemplateName();

  return (
    <li>
      <Link
        href={`/subscriptions/${sub.id}`}
        className="group flex items-center gap-4 rounded-2xl px-3 py-4 transition-colors hover:bg-muted/60 sm:px-4"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <mode.icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{sub.name}</div>
          <div className="mt-0.5 truncate text-sm text-muted-foreground">
            {mode.label} · {templateName(sub.template, sub.templateId)} · {sub.sourceCount} 个来源
          </div>
        </div>

        <div className="hidden w-20 text-right md:block">
          <div className="font-display text-lg tabular-nums">{sub.nodeCount}</div>
          <div className="text-xs text-muted-foreground">节点</div>
        </div>

        <div className="hidden w-36 text-right lg:block">
          <div className="text-sm">{sub.lastPulledAt ? formatRelative(sub.lastPulledAt) : "—"}</div>
          <div className="truncate text-xs text-muted-foreground">{sub.lastClient ?? "尚未被拉取"}</div>
        </div>

        <div className="hidden w-32 items-center justify-end gap-2 text-sm sm:flex">
          <StatusDot tone={issue ? issue.tone : "ok"} />
          <span className={issue ? (issue.tone === "error" ? "text-destructive" : "text-warning") : "text-muted-foreground"}>
            {issue ? issue.text : "正常"}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="复制订阅链接"
          onClick={(e) => {
            e.preventDefault();
            copyText(subscriptionUrl(sub.token), "订阅链接已复制");
          }}
        >
          <CopyIcon />
        </Button>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
