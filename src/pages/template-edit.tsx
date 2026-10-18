import {
  ArrowLeftIcon,
  BoxesIcon,
  FileTextIcon,
  LayoutTemplateIcon,
  ListTreeIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  ScrollTextIcon,
  SettingsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Link, useLocation, useSearch } from "wouter";
import { GroupPicker } from "@/components/group-picker";
import { CustomGroupDialog, GroupAdvancedDialog } from "@/components/group-settings";
import { PageHeader, Panel, PanelTitle } from "@/components/kit";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteTemplate, useMeta, useSaveTemplate, useTemplate } from "@/hooks/use-api";
import type { Meta, TemplateConfig, TemplateDetail } from "@/lib/api";
import { describeFilters, GROUP_TYPE_LABEL, type CustomGroup, type GroupAdvanced } from "@/lib/group-settings";
import { cn } from "@/lib/utils";

type Base = TemplateConfig["template"];
type Rule = TemplateConfig["customRules"][number];

const BASES: Base[] = ["minimal", "standard", "full"];

const RULE_TYPES = [
  { value: "DOMAIN-SUFFIX", hint: "example.com" },
  { value: "DOMAIN", hint: "www.example.com" },
  { value: "DOMAIN-KEYWORD", hint: "google" },
  { value: "GEOSITE", hint: "openai" },
  { value: "IP-CIDR", hint: "1.1.1.0/24" },
  { value: "IP-CIDR6", hint: "2001:db8::/32" },
  { value: "GEOIP", hint: "CN" },
  { value: "PROCESS-NAME", hint: "Telegram.exe" },
  { value: "DST-PORT", hint: "443" },
  { value: "SRC-PORT", hint: "8080" },
] as const satisfies ReadonlyArray<{ value: Rule["type"]; hint: string }>;

const LITERAL_TARGETS = ["DIRECT", "REJECT"] as const;

function encodeTarget(target: Rule["target"]): string {
  return typeof target === "string" ? target : `${target.kind}:${target.id}`;
}

function decodeTarget(value: string): Rule["target"] {
  const [kind, ...rest] = value.split(":");
  return kind === "module" || kind === "custom" ? { kind, id: rest.join(":") } : value;
}

function isTargetValid(target: Rule["target"], enabled: string[], customIds: string[]): boolean {
  if (typeof target === "string") return (LITERAL_TARGETS as readonly string[]).includes(target);
  return target.kind === "module" ? enabled.includes(target.id) : customIds.includes(target.id);
}

export function TemplateEditPage({ id }: { id?: string }) {
  const meta = useMeta();
  const detail = useTemplate(id ?? null);
  const base = new URLSearchParams(useSearch()).get("base");
  const backHref = "/templates";

  const header = (actions?: ReactNode) => (
    <PageHeader
      back={
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> 模板库
        </Link>
      }
      title={id ? (detail.data?.name ?? "编辑模板") : "新建模板"}
      description={
        id && detail.data
          ? detail.data.usedBy.length > 0
            ? `保存后会同步到 ${detail.data.usedBy.length} 个订阅：${detail.data.usedBy.map((s) => s.name).join("、")}`
            : "目前没有订阅使用此模板。"
          : "在内置模板基础上调整分流组、添加自定义规则。"
      }
      actions={actions}
    />
  );

  if (!meta.data || (id && !detail.data)) {
    return (
      <>
        {header()}
        {detail.isError ? (
          <Panel className="text-destructive">{detail.error.message}</Panel>
        ) : (
          <Skeleton className="h-[32rem] rounded-3xl" />
        )}
      </>
    );
  }

  const initialBase: Base = BASES.includes(base as Base) ? (base as Base) : "standard";
  return (
    <TemplateForm
      key={id ?? "new"}
      meta={meta.data}
      initial={id ? detail.data : undefined}
      initialBase={initialBase}
      header={header}
    />
  );
}

function TemplateForm({
  meta,
  initial,
  initialBase,
  header,
}: {
  meta: Meta;
  initial?: TemplateDetail;
  initialBase: Base;
  header: (actions?: ReactNode) => ReactNode;
}) {
  const [, navigate] = useLocation();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [config, setConfig] = useState<TemplateConfig>(
    () => structuredClone(initial?.config ?? meta.templateDefaults[initialBase]) as TemplateConfig
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomGroup | "new" | null>(null);
  const [advancedModule, setAdvancedModule] = useState<string | null>(null);
  const save = useSaveTemplate();
  const remove = useDeleteTemplate();

  const update = (patch: Partial<TemplateConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const customYaml = config.dnsYaml.trim() !== "";
  const enabled = config.enabledProxyGroups;
  const moduleName = (moduleId: string) => meta.modules.find((m) => m.id === moduleId)?.name ?? moduleId;
  const customGroups = config.customProxyGroups;
  const customIds = customGroups.map((g) => g.id);
  const advancedOf = (moduleId: string) => config.proxyGroupAdvanced?.[moduleId];

  const saveCustomGroup = (group: CustomGroup) => {
    setConfig((c) => {
      const exists = c.customProxyGroups.some((g) => g.id === group.id);
      return {
        ...c,
        customProxyGroups: exists ? c.customProxyGroups.map((g) => (g.id === group.id ? group : g)) : [...c.customProxyGroups, group],
      };
    });
    setEditingGroup(null);
  };
  const removeCustomGroup = (group: CustomGroup) => {
    const rules = config.customRules.filter((r) => !(typeof r.target === "object" && r.target.kind === "custom" && r.target.id === group.id));
    update({ customProxyGroups: customGroups.filter((g) => g.id !== group.id), customRules: rules });
    if (rules.length < config.customRules.length) toast.info(`已同时删除 ${config.customRules.length - rules.length} 条指向该分组的规则`);
  };
  const addRegionGroup = (region: Meta["regions"][number]) => {
    const name = `${region.emoji} ${region.label}自动`;
    if (customGroups.some((g) => g.name === name)) return toast.info(`「${name}」已存在`);
    saveCustomGroup({
      id: crypto.randomUUID().slice(0, 8),
      name,
      emoji: "",
      groupType: "url-test",
      memberSource: "filtered-nodes",
      includeInGroupMembers: true,
      advanced: { regions: [region.id as NonNullable<GroupAdvanced["regions"]>[number]] },
    });
  };
  const saveAdvanced = (moduleId: string, value: GroupAdvanced) => {
    const next = { ...config.proxyGroupAdvanced };
    if (Object.keys(value).length === 0) delete next[moduleId];
    else next[moduleId] = value;
    update({ proxyGroupAdvanced: next });
    setAdvancedModule(null);
  };

  const setRule = (index: number, patch: Partial<Rule>) =>
    update({ customRules: config.customRules.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  const addRule = () =>
    update({
      customRules: [
        ...config.customRules,
        { id: crypto.randomUUID().slice(0, 8), type: "DOMAIN-SUFFIX", value: "", target: { kind: "module", id: enabled[0] ?? "select" } },
      ],
    });

  const switchBase = (next: Base) => {
    if (next === config.template) return;
    update({ template: next, enabledProxyGroups: [...meta.templateDefaults[next].enabledProxyGroups] });
    toast.info("已切换基础模板，分流组恢复为该模板默认");
  };

  const submit = () => {
    if (!name.trim()) return toast.error("请填写模板名称");
    if (enabled.length === 0) return toast.error("至少启用一个分流组");
    const badRule = config.customRules.findIndex((r) => !r.value.trim() || !isTargetValid(r.target, enabled, customIds));
    if (badRule >= 0) return toast.error(`第 ${badRule + 1} 条自定义规则不完整，或目标分组未启用`);
    save.mutate(
      { id: initial?.id, input: { name: name.trim(), description: description.trim(), config } },
      {
        onSuccess: () => {
          toast.success(initial ? "模板已保存" : "模板已创建");
          navigate("/templates");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const doDelete = () =>
    remove.mutate(initial!.id, {
      onSuccess: () => {
        toast.success("模板已删除");
        navigate("/templates");
      },
      onError: (e) => toast.error(e.message),
    });

  return (
    <>
      {header(
        initial && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={initial.usedBy.length > 0}
            title={initial.usedBy.length > 0 ? "仍有订阅在使用，无法删除" : undefined}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2Icon /> 删除模板
          </Button>
        )
      )}

      <div className="max-w-4xl space-y-5">
        <Panel>
          <PanelTitle icon={FileTextIcon} title="基本信息" />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">名称</Label>
              <Input id="tpl-name" value={name} maxLength={80} placeholder="例如：AI + 流媒体" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">描述</Label>
              <Input
                id="tpl-desc"
                value={description}
                maxLength={500}
                placeholder="可选"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={LayoutTemplateIcon} title="基础模板" description="作为起点的内置模板，决定规则集的默认组合。" />
          <div className="grid gap-3 sm:grid-cols-3">
            {meta.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchBase(t.id as Base)}
                className={cn(
                  "rounded-2xl border-2 border-transparent bg-muted/60 p-4 text-left transition-all hover:bg-muted",
                  config.template === t.id && "border-primary bg-accent/60 hover:bg-accent/60"
                )}
              >
                <div className="font-medium">{t.name}</div>
                <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            icon={ListTreeIcon}
            title="分流组"
            description={`已启用 ${enabled.length} 个。客户端里每个分流组对应一个可切换节点的策略组。`}
          />
          <GroupPicker meta={meta} value={enabled} onChange={(v) => update({ enabledProxyGroups: v })} />
          <div className="mt-5 border-t pt-4">
            <div className="mb-2.5 text-sm text-muted-foreground">点击分流组可以设置节点筛选（按地区、正则）和分组类型：</div>
            <div className="flex flex-wrap gap-2">
              {enabled.map((moduleId) => {
                const summary = describeFilters(meta, advancedOf(moduleId));
                const type = advancedOf(moduleId)?.groupType;
                const configured = !!summary || !!type;
                return (
                  <button
                    key={moduleId}
                    type="button"
                    onClick={() => setAdvancedModule(moduleId)}
                    title={[type && GROUP_TYPE_LABEL[type], summary].filter(Boolean).join(" · ") || undefined}
                    className={cn(
                      "max-w-full truncate rounded-full border px-3 py-1 text-sm transition-colors",
                      configured
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-transparent bg-muted/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {moduleName(moduleId)}
                    {configured && <span className="ml-1.5 text-xs opacity-80">· {summary ?? GROUP_TYPE_LABEL[type!]}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            icon={BoxesIcon}
            title="自定义分组"
            description="把筛选出的节点组成新的策略组，例如「🇯🇵 日本自动」，可作为规则目标或其他分流组的选项。"
            action={
              <Button variant="outline" size="sm" onClick={() => setEditingGroup("new")}>
                <PlusIcon /> 添加分组
              </Button>
            }
          />
          {customGroups.length > 0 && (
            <ul className="mb-4 space-y-2.5">
              {customGroups.map((group) => (
                <li key={group.id} className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{group.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {GROUP_TYPE_LABEL[group.groupType]} · {describeFilters(meta, group.advanced) ?? "全部节点"}
                      {group.includeInGroupMembers === false && " · 不出现在其他分组"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="编辑分组" onClick={() => setEditingGroup(group)}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="删除分组" onClick={() => removeCustomGroup(group)}>
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">快速添加地区自动测速组：</span>
            {meta.regions
              .filter((r) => r.id !== "other")
              .map((r) => (
                <Button key={r.id} variant="secondary" size="sm" className="rounded-full" onClick={() => addRegionGroup(r)}>
                  {r.emoji} {r.label}
                </Button>
              ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            icon={ScrollTextIcon}
            title="自定义规则"
            description="把指定的域名、IP 或进程分流到某个分组。"
            action={
              <Button variant="outline" size="sm" onClick={addRule}>
                <PlusIcon /> 添加规则
              </Button>
            }
          />
          {config.customRules.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 py-8 text-center text-sm text-muted-foreground">
              暂无自定义规则，例如可以把 openai.com 指定走「🚀 节点选择」
            </p>
          ) : (
            <ul className="space-y-2.5">
              {config.customRules.map((rule, i) => {
                const hint = RULE_TYPES.find((t) => t.value === rule.type)?.hint;
                const targetOk = isTargetValid(rule.target, enabled, customIds);
                return (
                  <li key={rule.id ?? i} className="grid gap-2 rounded-2xl bg-muted/50 p-2.5 sm:grid-cols-[11.5rem_1fr_12rem_auto]">
                    <Select value={rule.type} onValueChange={(v) => setRule(i, { type: v as Rule["type"] })}>
                      <SelectTrigger className="w-full bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="bg-card font-mono text-sm"
                      value={rule.value}
                      placeholder={hint}
                      onChange={(e) => setRule(i, { value: e.target.value })}
                      aria-invalid={!rule.value.trim() || undefined}
                    />
                    <Select value={encodeTarget(rule.target)} onValueChange={(v) => setRule(i, { target: decodeTarget(v) })}>
                      <SelectTrigger className="w-full bg-card" aria-invalid={!targetOk || undefined}>
                        <SelectValue placeholder="目标分组" />
                      </SelectTrigger>
                      <SelectContent>
                        {enabled.map((g) => (
                          <SelectItem key={g} value={`module:${g}`}>
                            {moduleName(g)}
                          </SelectItem>
                        ))}
                        {customGroups.map((g) => (
                          <SelectItem key={g.id} value={`custom:${g.id}`}>
                            {g.name}
                          </SelectItem>
                        ))}
                        {LITERAL_TARGETS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t === "DIRECT" ? "DIRECT（直连）" : "REJECT（拒绝）"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="justify-self-end"
                      aria-label="删除规则"
                      onClick={() => update({ customRules: config.customRules.filter((_, j) => j !== i) })}
                    >
                      <XIcon />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            icon={SettingsIcon}
            title="基础配置"
            description="端口、局域网访问、DNS、嗅探等不属于分流的设置。"
            action={
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                自定义 YAML
                <Switch
                  checked={customYaml}
                  onCheckedChange={(on) => update({ dnsYaml: on ? meta.baseConfigYaml : "" })}
                />
              </label>
            }
          />
          {customYaml ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                这段 YAML 会完整替换默认的基础配置（含端口、DNS、嗅探）。不能包含 proxies / proxy-groups / rules。
              </p>
              <Textarea
                value={config.dnsYaml}
                onChange={(e) => update({ dnsYaml: e.target.value })}
                className="min-h-80 rounded-2xl font-mono text-xs leading-relaxed"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tpl-port">混合端口（mixed-port）</Label>
                <Input
                  id="tpl-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={config.mixedPort}
                  onChange={(e) => update({ mixedPort: Number(e.target.value) || 0 })}
                  aria-invalid={!(config.mixedPort >= 1 && config.mixedPort <= 65535) || undefined}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3 sm:mt-7">
                <div>
                  <div className="text-sm font-medium">允许局域网连接</div>
                  <div className="text-xs text-muted-foreground">allow-lan，让同一网络的设备使用这台电脑的代理</div>
                </div>
                <Switch checked={config.allowLan} onCheckedChange={(v) => update({ allowLan: v })} />
              </div>
            </div>
          )}
        </Panel>

        <div className="flex justify-end gap-2 pb-4">
          <Button variant="ghost" asChild>
            <Link href="/templates">取消</Link>
          </Button>
          <Button size="lg" onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            {initial ? "保存模板" : "创建模板"}
          </Button>
        </div>
      </div>

      <CustomGroupDialog
        meta={meta}
        open={editingGroup !== null}
        initial={editingGroup === "new" ? null : editingGroup}
        takenNames={[
          ...LITERAL_TARGETS,
          ...meta.modules.map((m) => m.name),
          ...customGroups.filter((g) => editingGroup === "new" || g.id !== editingGroup?.id).map((g) => g.name),
        ]}
        onOpenChange={(open) => !open && setEditingGroup(null)}
        onSave={saveCustomGroup}
      />
      <GroupAdvancedDialog
        meta={meta}
        moduleId={advancedModule}
        value={advancedModule ? advancedOf(advancedModule) : undefined}
        onOpenChange={(open) => !open && setAdvancedModule(null)}
        onSave={saveAdvanced}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除模板「{initial?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
