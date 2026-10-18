import {
  CheckCircle2Icon,
  ChevronDownIcon,
  Loader2Icon,
  ScanSearchIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMeta, usePreview, useSaveSubscription, useSubscription } from "@/hooks/use-api";
import type { Meta, PreviewResult, SubscriptionDetail, SubscriptionInput } from "@/lib/api";
import { INTERVAL_OPTIONS } from "@/lib/format";
import { MODE_META } from "@/lib/modes";
import { sourceLabel, sourcesToText, textToSources, type Source } from "@/lib/sources";
import { cn } from "@/lib/utils";

type Mode = SubscriptionInput["mode"];
type TemplateId = SubscriptionInput["config"]["template"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new subscription. */
  editingId: string | null;
  onSaved: (detail: SubscriptionDetail, created: boolean) => void;
};

const PLACEHOLDER = `每行一个机场订阅链接，例如：
https://example.com/api/v1/client/subscribe?token=xxxx

也可以直接粘贴节点（ss:// vmess:// vless:// trojan:// hy2:// …）、Base64 订阅内容或 Clash YAML`;

export function SubscriptionEditor({ open, onOpenChange, editingId, onSaved }: Props) {
  const detail = useSubscription(open ? editingId : null);
  const meta = useMeta();
  const ready = meta.data && (!editingId || detail.data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{editingId ? "编辑订阅" : "新建订阅"}</DialogTitle>
          <DialogDescription>粘贴来源 → 选择模板 → 保存即得订阅链接</DialogDescription>
        </DialogHeader>
        {ready ? (
          <EditorForm
            key={editingId ?? "new"}
            meta={meta.data}
            initial={editingId ? detail.data : undefined}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : (
          <div className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditorForm({
  meta,
  initial,
  onCancel,
  onSaved,
}: {
  meta: Meta;
  initial?: SubscriptionDetail;
  onCancel: () => void;
  onSaved: Props["onSaved"];
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [text, setText] = useState(initial ? sourcesToText(initial.config.sources) : "");
  const [mode, setMode] = useState<Mode>(initial?.mode ?? "provider");
  const [template, setTemplate] = useState<TemplateId>(initial?.config.template ?? "standard");
  const [customGroups, setCustomGroups] = useState<string[] | null>(initial?.config.enabledGroups ?? null);
  const [interval, setIntervalValue] = useState<string>(
    initial?.autoUpdateInterval ? String(initial.autoUpdateInterval) : String(6 * 3600)
  );
  const [showGroups, setShowGroups] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(
    initial ? { sources: [], nodeCount: initial.nodeCount, nodes: initial.nodes, userinfo: initial.userinfo } : null
  );

  const previewMutation = usePreview();
  const save = useSaveSubscription();

  const sources = useMemo(() => textToSources(text, initial?.config.sources), [text, initial]);
  const urlCount = sources.filter((s) => s.type === "url").length;
  const templateGroups = meta.templates.find((t) => t.id === template)?.groups ?? [];
  const enabledGroups = customGroups ?? templateGroups;

  const runPreview = () => {
    if (sources.length === 0) return;
    previewMutation.mutate(
      { mode, sources },
      { onSuccess: setPreview, onError: (e) => toast.error(e.message) }
    );
  };

  const submit = () => {
    if (sources.length === 0) return toast.error("请至少填写一个订阅链接或节点");
    if (sources.length > 20) return toast.error("最多支持 20 个订阅链接");
    const input: SubscriptionInput = {
      name: name.trim() || (urlCount > 0 ? sourceLabel(sources[0]) : "我的订阅"),
      mode,
      autoUpdateInterval: mode === "snapshot" && interval !== "off" ? Number(interval) : null,
      config: { sources, template, ...(customGroups ? { enabledGroups: customGroups } : {}) },
    };
    save.mutate(
      { id: initial?.id, input },
      {
        onSuccess: (d) => {
          if (d.lastError) toast.warning("已保存，但部分来源有问题", { description: d.lastError });
          onSaved(d, !initial);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const toggleGroup = (id: string, checked: boolean) => {
    const next = checked ? [...enabledGroups, id] : enabledGroups.filter((g) => g !== id);
    setCustomGroups(next);
  };

  const categories = useMemo(() => {
    const byCat = new Map<string, Meta["modules"]>();
    for (const m of meta.modules) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m]);
    return [...byCat.entries()].sort(
      ([a], [b]) => (meta.categories[a]?.order ?? 99) - (meta.categories[b]?.order ?? 99)
    );
  }, [meta]);

  return (
    <>
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_22rem] lg:overflow-hidden">
        <div className="space-y-6 p-6 lg:overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="sf-name">名称</Label>
            <Input
              id="sf-name"
              placeholder="可留空，默认使用机场域名"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sf-sources">订阅来源</Label>
              <span className="text-xs text-muted-foreground">
                {urlCount} 个链接{sources.some((s) => s.type === "nodes") ? " + 手动节点" : ""}
              </span>
            </div>
            <Textarea
              id="sf-sources"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPreview(null);
              }}
              placeholder={PLACEHOLDER}
              className="min-h-36 font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <Label>节点获取方式</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(MODE_META) as Mode[]).map((m) => {
                const info = MODE_META[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex gap-3 rounded-xl border p-3 text-left transition-all hover:border-primary/50",
                      mode === m && "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                  >
                    <info.icon className={cn("mt-0.5 size-4 shrink-0", mode === m && "text-primary")} />
                    <div>
                      <div className="text-sm font-medium">
                        {info.label}
                        {m === "provider" && <span className="ml-1.5 text-xs text-primary">推荐</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {m === "provider"
                          ? "生成 proxy-providers，客户端自己去机场拉取节点。机场屏蔽 Cloudflare 时也能用。"
                          : "Cloudflare 定时抓取机场订阅并展开为节点，可显示流量信息。"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {mode === "snapshot" && (
              <div className="flex items-center gap-3 pt-1">
                <span className="text-sm text-muted-foreground">自动更新</span>
                <Select value={interval} onValueChange={setIntervalValue}>
                  <SelectTrigger size="sm" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>规则模板</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {meta.templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTemplate(t.id as TemplateId);
                    setCustomGroups(null);
                  }}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all hover:border-primary/50",
                    template === t.id && "border-primary bg-primary/5 ring-1 ring-primary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.groupCount} 组</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowGroups((v) => !v)}
              className="flex items-center gap-1 pt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDownIcon className={cn("size-3.5 transition-transform", showGroups && "rotate-180")} />
              自定义分流组（已启用 {enabledGroups.length} 个{customGroups ? "，已自定义" : ""}）
            </button>
            {showGroups && (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                {categories.map(([cat, modules]) => (
                  <div key={cat}>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">{meta.categories[cat]?.name ?? cat}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                      {modules.map((m) => (
                        <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm" title={m.description}>
                          <Checkbox
                            checked={enabledGroups.includes(m.id)}
                            onCheckedChange={(v) => toggleGroup(m.id, v === true)}
                          />
                          <span className="truncate">{m.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {customGroups && (
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setCustomGroups(null)}>
                    恢复模板默认
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <PreviewPanel
          sources={sources}
          preview={preview}
          pending={previewMutation.isPending}
          onPreview={runPreview}
          mode={mode}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-3">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={submit} disabled={save.isPending || sources.length === 0}>
          {save.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          {initial ? "保存修改" : "生成订阅"}
        </Button>
      </div>
    </>
  );
}

function PreviewPanel({
  sources,
  preview,
  pending,
  onPreview,
  mode,
}: {
  sources: Source[];
  preview: PreviewResult | null;
  pending: boolean;
  onPreview: () => void;
  mode: Mode;
}) {
  return (
    <div className="flex min-h-72 flex-col border-t bg-muted/20 lg:min-h-0 lg:border-t-0 lg:border-l">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="text-sm font-medium">
          节点预览
          {preview && <span className="ml-1.5 text-muted-foreground tabular-nums">{preview.nodeCount}</span>}
        </div>
        <Button size="sm" variant="outline" onClick={onPreview} disabled={pending || sources.length === 0}>
          {pending ? <Loader2Icon className="animate-spin" /> : <ScanSearchIcon />}
          解析
        </Button>
      </div>

      {preview && preview.sources.length > 0 && (
        <div className="space-y-1 px-4 pb-2">
          {preview.sources.map((r) => {
            const source = sources.find((s) => s.id === r.id);
            return (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                {r.error ? (
                  <XCircleIcon className="size-3.5 shrink-0 text-destructive" />
                ) : (
                  <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-500" />
                )}
                <span className="min-w-0 flex-1 truncate">{source ? sourceLabel(source) : r.id}</span>
                <span className={cn("shrink-0 text-muted-foreground", r.error && "text-destructive")} title={r.error}>
                  {r.error ? "失败" : `${r.nodeCount} 个`}
                </span>
              </div>
            );
          })}
          {mode === "provider" && preview.sources.some((r) => r.type === "url" && r.error) && (
            <p className="pt-1 text-xs text-muted-foreground">
              客户端拉取模式下，链接由你的客户端直接访问，Cloudflare 抓取失败通常不影响使用。
            </p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {preview ? (
          preview.nodes.length > 0 ? (
            <ul className="space-y-0.5">
              {preview.nodes.map((n, i) => (
                <li key={`${n.name}-${i}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60">
                  <Badge variant="outline" className="w-16 shrink-0 justify-center font-mono text-[10px] uppercase">
                    {n.type}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate" title={n.name}>
                    {n.name}
                  </span>
                </li>
              ))}
              {preview.nodeCount > preview.nodes.length && (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">
                  …另有 {preview.nodeCount - preview.nodes.length} 个节点
                </li>
              )}
            </ul>
          ) : (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">没有解析到节点</p>
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center text-xs text-muted-foreground">
            <ScanSearchIcon className="size-8 opacity-40" />
            点击「解析」查看节点，确认来源可用
          </div>
        )}
      </div>
    </div>
  );
}
