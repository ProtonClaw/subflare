import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FileTextIcon,
  ListTreeIcon,
  Loader2Icon,
  ScanSearchIcon,
  SparklesIcon,
  WaypointsIcon,
  XCircleIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { PageHeader, Panel, PanelTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const PLACEHOLDER = `每行一个机场订阅链接，例如：
https://example.com/api/v1/client/subscribe?token=xxxx

也可以直接粘贴节点（ss:// vmess:// vless:// trojan:// hy2:// …）、Base64 订阅内容或 Clash YAML`;

const MODE_DESCRIPTION: Record<Mode, string> = {
  provider: "生成 proxy-providers，客户端自己去机场拉取节点。机场屏蔽 Cloudflare 时也能用。",
  snapshot: "Cloudflare 定时抓取机场订阅并展开为节点，可显示流量和到期信息。",
};

/** `id` undefined = create a new subscription. */
export function SubscriptionEditPage({ id }: { id?: string }) {
  const detail = useSubscription(id ?? null);
  const meta = useMeta();
  const backHref = id ? `/subscriptions/${id}` : "/subscriptions";

  const header = (
    <PageHeader
      back={
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> {id ? "返回订阅" : "我的订阅"}
        </Link>
      }
      title={id ? "编辑订阅" : "新建订阅"}
      description="粘贴来源，选择获取方式和模板，保存即得订阅链接。"
    />
  );

  if (!meta.data || (id && !detail.data)) {
    return (
      <>
        {header}
        {detail.isError ? (
          <Panel className="text-destructive">{detail.error.message}</Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <Skeleton className="h-[32rem] rounded-3xl" />
            <Skeleton className="h-80 rounded-3xl" />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <EditorForm key={id ?? "new"} meta={meta.data} initial={id ? detail.data : undefined} backHref={backHref} />
    </>
  );
}

function EditorForm({ meta, initial, backHref }: { meta: Meta; initial?: SubscriptionDetail; backHref: string }) {
  const [, navigate] = useLocation();
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
    previewMutation.mutate({ mode, sources }, { onSuccess: setPreview, onError: (e) => toast.error(e.message) });
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
          else if (initial) toast.success("已保存");
          navigate(`/subscriptions/${d.id}${initial ? "" : "?created=1"}`);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const toggleGroup = (groupId: string, checked: boolean) =>
    setCustomGroups(checked ? [...enabledGroups, groupId] : enabledGroups.filter((g) => g !== groupId));

  const categories = useMemo(() => {
    const byCat = new Map<string, Meta["modules"]>();
    for (const m of meta.modules) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m]);
    return [...byCat.entries()].sort(([a], [b]) => (meta.categories[a]?.order ?? 99) - (meta.categories[b]?.order ?? 99));
  }, [meta]);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        <Panel>
          <PanelTitle icon={FileTextIcon} title="订阅来源" description="链接和节点可以混合粘贴，会自动识别。" />
          <div className="space-y-5">
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
                <Label htmlFor="sf-sources">链接 / 节点</Label>
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
                className="min-h-44 rounded-2xl font-mono text-xs leading-relaxed"
                spellCheck={false}
              />
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={WaypointsIcon} title="节点获取方式" />
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(MODE_META) as Mode[]).map((m) => {
              const info = MODE_META[m];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex gap-3 rounded-2xl border-2 border-transparent bg-muted/60 p-4 text-left transition-all hover:bg-muted",
                    mode === m && "border-primary bg-accent/60 hover:bg-accent/60"
                  )}
                >
                  <info.icon className={cn("mt-0.5 size-4 shrink-0", mode === m ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <div className="font-medium">
                      {info.label}
                      {m === "provider" && <span className="ml-2 text-xs text-primary">推荐</span>}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{MODE_DESCRIPTION[m]}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {mode === "snapshot" && (
            <div className="mt-5 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">自动更新</span>
              <Select value={interval} onValueChange={setIntervalValue}>
                <SelectTrigger className="w-40">
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
        </Panel>

        <Panel>
          <PanelTitle icon={ListTreeIcon} title="规则模板" description="决定生成哪些分流组和规则。" />
          <div className="grid gap-3 sm:grid-cols-3">
            {meta.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTemplate(t.id as TemplateId);
                  setCustomGroups(null);
                }}
                className={cn(
                  "rounded-2xl border-2 border-transparent bg-muted/60 p-4 text-left transition-all hover:bg-muted",
                  template === t.id && "border-primary bg-accent/60 hover:bg-accent/60"
                )}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.groupCount} 组</span>
                </div>
                <div className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{t.description}</div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowGroups((v) => !v)}
            className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon className={cn("size-4 transition-transform", showGroups && "rotate-180")} />
            自定义分流组（已启用 {enabledGroups.length} 个{customGroups ? "，已自定义" : ""}）
          </button>
          {showGroups && (
            <div className="mt-4 space-y-5 rounded-2xl bg-muted/50 p-5">
              {categories.map(([cat, modules]) => (
                <div key={cat}>
                  <div className="mb-2.5 text-xs font-medium text-muted-foreground">{meta.categories[cat]?.name ?? cat}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                    {modules.map((m) => (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm" title={m.description}>
                        <Checkbox checked={enabledGroups.includes(m.id)} onCheckedChange={(v) => toggleGroup(m.id, v === true)} />
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
        </Panel>

        <div className="flex justify-end gap-2 pb-4">
          <Button variant="ghost" asChild>
            <Link href={backHref}>取消</Link>
          </Button>
          <Button size="lg" onClick={submit} disabled={save.isPending || sources.length === 0}>
            {save.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {initial ? "保存修改" : "生成订阅"}
          </Button>
        </div>
      </div>

      <PreviewPanel sources={sources} preview={preview} pending={previewMutation.isPending} onPreview={runPreview} mode={mode} />
    </div>
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
    <Panel className="flex flex-col lg:sticky lg:top-6 lg:max-h-[calc(100svh-3rem)]">
      <PanelTitle
        icon={ScanSearchIcon}
        title="节点预览"
        description={preview ? `${preview.nodeCount} 个节点` : "确认来源可用"}
        action={
          <Button size="sm" variant="outline" onClick={onPreview} disabled={pending || sources.length === 0}>
            {pending ? <Loader2Icon className="animate-spin" /> : <ScanSearchIcon />}
            解析
          </Button>
        }
      />

      {preview && preview.sources.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {preview.sources.map((r) => {
            const source = sources.find((s) => s.id === r.id);
            return (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                {r.error ? (
                  <XCircleIcon className="size-4 shrink-0 text-destructive" />
                ) : (
                  <CheckCircle2Icon className="size-4 shrink-0 text-success" />
                )}
                <span className="min-w-0 flex-1 truncate">{source ? sourceLabel(source) : r.id}</span>
                <span className={cn("shrink-0 text-xs text-muted-foreground", r.error && "text-destructive")} title={r.error}>
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

      <div className="-mx-2 min-h-40 flex-1 overflow-y-auto">
        {preview ? (
          preview.nodes.length > 0 ? (
            <ul className="space-y-0.5">
              {preview.nodes.map((n, i) => (
                <li key={`${n.name}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-muted/60">
                  <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground uppercase">{n.type}</span>
                  <span className="min-w-0 flex-1 truncate" title={n.name}>
                    {n.name}
                  </span>
                </li>
              ))}
              {preview.nodeCount > preview.nodes.length && (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">…另有 {preview.nodeCount - preview.nodes.length} 个节点</li>
              )}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">没有解析到节点</p>
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
            <ScanSearchIcon className="size-8 opacity-40" />
            点击「解析」查看节点
          </div>
        )}
      </div>
    </Panel>
  );
}
