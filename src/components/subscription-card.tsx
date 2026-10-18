import {
  AlertTriangleIcon,
  CopyIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  QrCodeIcon,
  RefreshCwIcon,
  RotateCcwKeyIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/share-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDeleteSubscription, useRefreshSubscription, useRotateToken } from "@/hooks/use-api";
import { subscriptionUrl, type SubscriptionSummary } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { MODE_META } from "@/lib/modes";
import { formatBytes, formatDate, formatRelative, intervalLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const TEMPLATE_LABEL = { minimal: "精简", standard: "标准", full: "完整" } as const;

function Usage({ info }: { info: NonNullable<SubscriptionSummary["userinfo"]> }) {
  const used = (info.upload ?? 0) + (info.download ?? 0);
  const total = info.total ?? 0;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {formatBytes(used)} / {total > 0 ? formatBytes(total) : "∞"}
        </span>
        {info.expire ? <span>到期 {formatDate(info.expire)}</span> : null}
      </div>
      {total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r from-orange-400 to-rose-500 transition-all",
              pct > 90 && "from-rose-500 to-red-600"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SubscriptionCard({ sub, onEdit }: { sub: SubscriptionSummary; onEdit: () => void }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "rotate" | null>(null);
  const refresh = useRefreshSubscription();
  const rotate = useRotateToken();
  const remove = useDeleteSubscription();
  const mode = MODE_META[sub.mode];

  const doRefresh = () =>
    refresh.mutate(sub.id, {
      onSuccess: (d) =>
        d.lastError ? toast.warning("部分来源更新失败", { description: d.lastError }) : toast.success(`已更新，${d.nodeCount} 个节点`),
      onError: (e) => toast.error(e.message),
    });

  const doConfirm = () => {
    if (confirm === "delete") {
      remove.mutate(sub.id, { onSuccess: () => toast.success("已删除"), onError: (e) => toast.error(e.message) });
    } else if (confirm === "rotate") {
      rotate.mutate(sub.id, {
        onSuccess: ({ token }) => copyText(subscriptionUrl(token), "链接已重置，新链接已复制"),
        onError: (e) => toast.error(e.message),
      });
    }
    setConfirm(null);
  };

  return (
    <div className="group relative flex flex-col gap-4 rounded-2xl border bg-card/70 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-orange-500/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold" title={sub.name}>
            {sub.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1">
                  <mode.icon className="size-3" /> {mode.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{mode.hint}</TooltipContent>
            </Tooltip>
            <Badge variant="outline">{TEMPLATE_LABEL[sub.template]}模板</Badge>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="更多操作">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon /> 编辑
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={doRefresh}>
              <RefreshCwIcon /> 立即更新
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirm("rotate")}>
              <RotateCcwKeyIcon /> 重置链接
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
              <Trash2Icon /> 删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 px-3 py-2">
          <div className="text-2xl font-semibold tabular-nums">{sub.nodeCount}</div>
          <div className="text-xs text-muted-foreground">{sub.mode === "provider" ? "内联节点" : "节点"}</div>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2">
          <div className="text-2xl font-semibold tabular-nums">{sub.sourceCount}</div>
          <div className="text-xs text-muted-foreground">订阅来源</div>
        </div>
      </div>

      {sub.userinfo && <Usage info={sub.userinfo} />}

      {sub.lastError && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-3 break-all">{sub.lastError}</span>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="min-w-0 text-xs text-muted-foreground">
          <div className="truncate">更新于 {formatRelative(sub.lastRefreshedAt)}</div>
          {sub.mode === "snapshot" && <div className="truncate">{intervalLabel(sub.autoUpdateInterval)}</div>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={doRefresh} disabled={refresh.isPending} aria-label="立即更新">
                {refresh.isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>立即更新</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={() => setShareOpen(true)} aria-label="二维码">
                <QrCodeIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>二维码 / 导入</TooltipContent>
          </Tooltip>
          <Button size="sm" onClick={() => copyText(subscriptionUrl(sub.token), "订阅链接已复制")}>
            <CopyIcon /> 复制链接
          </Button>
        </div>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} name={sub.name} token={sub.token} />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? `删除「${sub.name}」？` : "重置订阅链接？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "删除后订阅链接立即失效，此操作无法撤销。"
                : "旧链接将立即失效，需要在所有客户端中更新为新链接。"}
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
    </div>
  );
}
