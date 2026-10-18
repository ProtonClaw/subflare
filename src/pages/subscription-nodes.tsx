import {
  ArrowLeftIcon,
  CheckIcon,
  LayersIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { PageHeader, Panel, PanelTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useEditNodes, useNodeState, useSubscription } from "@/hooks/use-api";
import type { NodeEdits, NodeState, SubscriptionDetail } from "@/lib/api";
import { planRenames, type RenameRule } from "@/lib/node-rename";
import { sourceLabel } from "@/lib/sources";
import { cn } from "@/lib/utils";

type NodeRow = NodeState["nodes"][number];

export function SubscriptionNodesPage({ id }: { id: string }) {
  const detail = useSubscription(id);
  const state = useNodeState(id);

  const header = (
    <PageHeader
      back={
        <Link href={`/subscriptions/${id}?tab=nodes`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> 返回订阅
        </Link>
      }
      title="节点管理"
      description={detail.data ? `${detail.data.name} · 改名和删除会在每次更新后保留` : undefined}
    />
  );

  if (detail.isError || state.isError) {
    return (
      <>
        {header}
        <Panel className="text-destructive">{(detail.error ?? state.error)?.message}</Panel>
      </>
    );
  }
  if (!detail.data || !state.data) {
    return (
      <>
        {header}
        <Skeleton className="h-[28rem] rounded-3xl" />
      </>
    );
  }
  return (
    <>
      {header}
      <NodeManager sub={detail.data} state={state.data} />
    </>
  );
}

function NodeManager({ sub, state }: { sub: SubscriptionDetail; state: NodeState }) {
  const edit = useEditNodes(sub.id);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const sourceNames = useMemo(
    () => new Map(sub.config.sources.map((s, i) => [s.id, `${i + 1}. ${sourceLabel(s)}`])),
    [sub.config.sources]
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.nodes;
    return state.nodes.filter((n) =>
      [n.name, n.originName, n.server ?? ""].some((field) => String(field).toLowerCase().includes(q))
    );
  }, [state.nodes, query]);

  const run = (edits: NodeEdits, success: string, after?: () => void) =>
    edit.mutate(edits, {
      onSuccess: () => {
        toast.success(success);
        after?.();
      },
      onError: (e) => toast.error(e.message),
    });

  const selectedVisible = visible.filter((n) => selected.has(n.name));
  const allVisibleSelected = visible.length > 0 && selectedVisible.length === visible.length;
  const toggleAll = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const n of visible) {
        if (on) next.add(n.name);
        else next.delete(n.name);
      }
      return next;
    });
  const toggle = (name: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });

  const submitRename = () => {
    if (!renaming) return;
    if (!renaming.to.trim() || renaming.to.trim() === renaming.from) return setRenaming(null);
    run({ rename: [{ from: renaming.from, to: renaming.to.trim() }] }, "已重命名", () => setRenaming(null));
  };

  const deleteSelected = () => {
    const names = [...selected].filter((name) => state.nodes.some((n) => n.name === name));
    run({ delete: names }, `已删除 ${names.length} 个节点`, () => setSelected(new Set()));
  };

  return (
    <div className="max-w-5xl space-y-5">
      {sub.mode === "provider" && (
        <Panel className="text-sm text-muted-foreground">
          当前是「客户端拉取」模式：订阅链接里的节点由客户端直接获取，这里只能管理手动粘贴的节点。
        </Panel>
      )}
      {sub.config.nodeRules && (
        <Panel className="text-sm text-muted-foreground">
          这里显示的是改名规则套用前的名称；生成订阅时还会按「编辑订阅 → 节点处理」中的规则改名和排序。
        </Panel>
      )}

      <Panel>
        <PanelTitle
          icon={LayersIcon}
          title={`节点（${state.nodes.length}）`}
          action={
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} disabled={state.nodes.length === 0}>
              <WandSparklesIcon /> 批量重命名
            </Button>
          }
        />

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索名称、原名或服务器" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">已选 {selected.size} 个</span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                取消选择
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={deleteSelected}
                disabled={edit.isPending}
              >
                <Trash2Icon /> 删除所选
              </Button>
            </div>
          )}
        </div>

        {state.nodes.length === 0 ? (
          <p className="rounded-2xl bg-muted/50 py-10 text-center text-sm text-muted-foreground">没有节点</p>
        ) : (
          <>
            <label className="flex items-center gap-3 border-b px-3 pb-2.5 text-xs text-muted-foreground">
              <Checkbox checked={allVisibleSelected} onCheckedChange={(v) => toggleAll(v === true)} />
              {query ? `全选匹配的 ${visible.length} 个` : "全选"}
            </label>
            <ul className="divide-y">
              {visible.map((node) => (
                <NodeItem
                  key={node.name}
                  node={node}
                  source={node.sourceId ? sourceNames.get(node.sourceId) : undefined}
                  checked={selected.has(node.name)}
                  onCheck={(on) => toggle(node.name, on)}
                  renaming={renaming?.from === node.name ? renaming.to : null}
                  onRenameStart={() => setRenaming({ from: node.name, to: node.name })}
                  onRenameChange={(to) => setRenaming({ from: node.name, to })}
                  onRenameSubmit={submitRename}
                  onRenameCancel={() => setRenaming(null)}
                  onRestoreName={() => run({ rename: [{ from: node.name, to: node.originName }] }, "已恢复原名")}
                  onDelete={() => run({ delete: [node.name] }, "已删除节点")}
                  busy={edit.isPending}
                />
              ))}
            </ul>
            {visible.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">没有匹配的节点</p>}
          </>
        )}
      </Panel>

      {state.deleted.length > 0 && (
        <Panel>
          <PanelTitle
            icon={Trash2Icon}
            title={`已删除（${state.deleted.length}）`}
            description="更新订阅时这些节点不会再出现，恢复后会重新加入。"
          />
          <ul className="divide-y">
            {state.deleted.map((item) => (
              <li key={item.index} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground uppercase">{item.type}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through" title={item.name}>
                  {item.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => run({ restore: [item.index] }, "已恢复节点")}
                  disabled={edit.isPending}
                >
                  <RotateCcwIcon /> 恢复
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <BulkRenameDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        allNames={state.nodes.map((n) => n.name)}
        selected={[...selected].filter((name) => state.nodes.some((n) => n.name === name))}
        pending={edit.isPending}
        onApply={(rename) => run({ rename }, `已重命名 ${rename.length} 个节点`, () => setBulkOpen(false))}
      />
    </div>
  );
}

function NodeItem(props: {
  node: NodeRow;
  source?: string;
  checked: boolean;
  onCheck: (on: boolean) => void;
  renaming: string | null;
  onRenameStart: () => void;
  onRenameChange: (to: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onRestoreName: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { node } = props;
  const meta = [node.type.toUpperCase(), node.server ? `${node.server}:${node.port}` : null, props.source]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("group flex items-center gap-3 px-3 py-2.5", props.checked && "bg-accent/40")}>
      <Checkbox checked={props.checked} onCheckedChange={(v) => props.onCheck(v === true)} aria-label={`选择 ${node.name}`} />
      <div className="min-w-0 flex-1">
        {props.renaming !== null ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              props.onRenameSubmit();
            }}
          >
            <Input
              autoFocus
              value={props.renaming}
              maxLength={120}
              onChange={(e) => props.onRenameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && props.onRenameCancel()}
              className="h-8"
            />
            <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label="保存名称" disabled={props.busy}>
              <CheckIcon />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="取消" onClick={props.onRenameCancel}>
              <XIcon />
            </Button>
          </form>
        ) : (
          <>
            <div className="truncate text-sm" title={node.name}>
              {node.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {node.renamed && (
                <>
                  <span title={node.originName}>原名：{node.originName}</span>
                  <span className="mx-1.5">·</span>
                </>
              )}
              {meta}
            </div>
          </>
        )}
      </div>
      {props.renaming === null && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
          {node.renamed && (
            <Button variant="ghost" size="icon" className="size-8" aria-label="恢复原名" title="恢复原名" onClick={props.onRestoreName} disabled={props.busy}>
              <RotateCcwIcon />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-8" aria-label="重命名" title="重命名" onClick={props.onRenameStart}>
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            aria-label="删除节点"
            title="删除"
            onClick={props.onDelete}
            disabled={props.busy}
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </li>
  );
}

const EMPTY_RULE: RenameRule = { include: "", exclude: "", find: "", replace: "", trim: true };
const PREVIEW_LIMIT = 100;

function BulkRenameDialog({
  open,
  onOpenChange,
  allNames,
  selected,
  pending,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allNames: string[];
  selected: string[];
  pending: boolean;
  onApply: (rename: Array<{ from: string; to: string }>) => void;
}) {
  const [rule, setRule] = useState<RenameRule>(EMPTY_RULE);
  const scope = selected.length > 0 ? selected : allNames;
  const plan = useMemo(() => planRenames(allNames, scope, rule), [allNames, scope, rule]);
  const valid = plan.changes.filter((c) => !c.problem);
  const set = (patch: Partial<RenameRule>) => setRule((r) => ({ ...r, ...patch }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setRule(EMPTY_RULE);
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量重命名</DialogTitle>
          <DialogDescription>
            {selected.length > 0 ? `作用于已选的 ${selected.length} 个节点。` : `作用于全部 ${allNames.length} 个节点。`}
            用正则查找并替换，支持 $1、$2 引用分组。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rn-include">只处理匹配的（正则，可选）</Label>
            <Input id="rn-include" placeholder="例如：香港|HK" value={rule.include} onChange={(e) => set({ include: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rn-exclude">跳过匹配的（正则，可选）</Label>
            <Input id="rn-exclude" placeholder="例如：测试|过期" value={rule.exclude} onChange={(e) => set({ exclude: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rn-find">查找（正则）</Label>
            <Input id="rn-find" className="font-mono" placeholder="例如：^(\S+) (\d+)$" value={rule.find} onChange={(e) => set({ find: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rn-replace">替换为</Label>
            <Input
              id="rn-replace"
              className="font-mono"
              placeholder="例如：$1-$2，留空即删除匹配内容"
              value={rule.replace}
              onChange={(e) => set({ replace: e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={rule.trim} onCheckedChange={(v) => set({ trim: v })} />
          合并连续空格并去除首尾空格
        </label>

        <div className="rounded-2xl bg-muted/50 p-4">
          <div className="mb-2 text-xs text-muted-foreground">
            {plan.error ? (
              <span className="text-destructive">{plan.error}</span>
            ) : (
              <>
                匹配 {plan.matched} 个，将修改 {valid.length} 个
                {plan.changes.length > valid.length && `，跳过 ${plan.changes.length - valid.length} 个（名称为空或重复）`}
              </>
            )}
          </div>
          {plan.changes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">暂无变更</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {plan.changes.slice(0, PREVIEW_LIMIT).map((c) => (
                <li key={c.from} className={cn("grid grid-cols-[1fr_auto_1fr] items-center gap-2", c.problem && "opacity-50")}>
                  <span className="truncate text-muted-foreground" title={c.from}>
                    {c.from}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className={cn("truncate", c.problem && "text-destructive line-through")} title={c.to}>
                    {c.to || "（空）"}
                  </span>
                </li>
              ))}
              {plan.changes.length > PREVIEW_LIMIT && (
                <li className="pt-1 text-xs text-muted-foreground">…还有 {plan.changes.length - PREVIEW_LIMIT} 个</li>
              )}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => onApply(valid.map(({ from, to }) => ({ from, to })))} disabled={pending || valid.length === 0}>
            {pending && <Loader2Icon className="animate-spin" />}
            应用 {valid.length > 0 ? `${valid.length} 个` : ""}修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
