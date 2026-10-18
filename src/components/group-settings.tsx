import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Meta } from "@/lib/api";
import {
  compactAdvanced,
  GROUP_TYPE_LABEL,
  hasInvalidRegex,
  isValidRegex,
  STRATEGY_LABEL,
  type CustomGroup,
  type GroupAdvanced,
  type GroupType,
  type Region,
} from "@/lib/group-settings";
import { cn } from "@/lib/utils";

export function GroupTypeFields({
  type,
  strategy,
  onChange,
  types = ["select", "url-test", "fallback", "load-balance"],
}: {
  type: GroupType;
  strategy?: CustomGroup["strategy"];
  onChange: (patch: { groupType: GroupType; strategy?: CustomGroup["strategy"] }) => void;
  types?: GroupType[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>分组类型</Label>
        <Select
          value={type}
          onValueChange={(v) => onChange({ groupType: v as GroupType, strategy: v === "load-balance" ? (strategy ?? "consistent-hashing") : undefined })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {GROUP_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {type === "load-balance" && (
        <div className="space-y-2">
          <Label>负载均衡策略</Label>
          <Select value={strategy ?? "consistent-hashing"} onValueChange={(v) => onChange({ groupType: type, strategy: v as CustomGroup["strategy"] })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STRATEGY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export function NodeFilterFields({
  meta,
  value,
  onChange,
}: {
  meta: Meta;
  value: GroupAdvanced;
  onChange: (value: GroupAdvanced) => void;
}) {
  const regions = value.regions ?? [];
  const toggleRegion = (id: Region) =>
    onChange({ ...value, regions: regions.includes(id) ? regions.filter((r) => r !== id) : [...regions, id] });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>地区（按节点名识别，多选为「任一」）</Label>
        <div className="flex flex-wrap gap-2">
          {meta.regions.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggleRegion(r.id as Region)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                regions.includes(r.id as Region)
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-transparent bg-muted/70 text-muted-foreground hover:text-foreground"
              )}
            >
              {r.emoji} {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gf-include">名称包含（正则，可选）</Label>
          <Input
            id="gf-include"
            className="font-mono"
            placeholder="例如：IEPL|专线"
            value={value.includeRegex ?? ""}
            aria-invalid={!isValidRegex(value.includeRegex) || undefined}
            onChange={(e) => onChange({ ...value, includeRegex: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gf-exclude">名称排除（正则，可选）</Label>
          <Input
            id="gf-exclude"
            className="font-mono"
            placeholder="例如：测试|过期|0\.1x"
            value={value.excludeRegex ?? ""}
            aria-invalid={!isValidRegex(value.excludeRegex) || undefined}
            onChange={(e) => onChange({ ...value, excludeRegex: e.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        「客户端拉取」模式下会转换成 mihomo 的 filter，由客户端筛选；「云端快照」模式下直接在服务端筛选。
      </p>
    </div>
  );
}

export function CustomGroupDialog({
  meta,
  open,
  initial,
  takenNames,
  onOpenChange,
  onSave,
}: {
  meta: Meta;
  open: boolean;
  initial: CustomGroup | null;
  takenNames: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (group: CustomGroup) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        {open && (
          <CustomGroupForm
            key={initial?.id ?? "new"}
            meta={meta}
            initial={initial}
            takenNames={takenNames}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CustomGroupForm({
  meta,
  initial,
  takenNames,
  onCancel,
  onSave,
}: {
  meta: Meta;
  initial: CustomGroup | null;
  takenNames: string[];
  onCancel: () => void;
  onSave: (group: CustomGroup) => void;
}) {
  const [group, setGroup] = useState<CustomGroup>(
    () =>
      initial ?? {
        id: crypto.randomUUID().slice(0, 8),
        name: "",
        emoji: "",
        groupType: "url-test",
        memberSource: "filtered-nodes",
        includeInGroupMembers: true,
        advanced: {},
      }
  );
  const name = group.name.trim();
  const nameError = !name ? "请填写名称" : takenNames.includes(name) ? "名称与其他分组重复" : null;
  const advanced = group.advanced ?? {};

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial ? "编辑分组" : "添加分组"}</DialogTitle>
        <DialogDescription>由筛选出的节点组成，例如「🇯🇵 日本自动」。可以作为规则目标，也可以出现在其他分流组的选项里。</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="cg-name">名称</Label>
          <Input
            id="cg-name"
            placeholder="例如：🇯🇵 日本自动"
            maxLength={60}
            value={group.name}
            aria-invalid={(group.name !== "" && !!nameError) || undefined}
            onChange={(e) => setGroup({ ...group, name: e.target.value })}
          />
          {group.name !== "" && nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>
        <GroupTypeFields
          type={group.groupType}
          strategy={group.strategy}
          onChange={({ groupType, strategy }) => setGroup({ ...group, groupType, strategy })}
        />
        <NodeFilterFields meta={meta} value={advanced} onChange={(next) => setGroup({ ...group, advanced: next })} />
        <label className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3">
          <div>
            <div className="text-sm font-medium">出现在其他分流组的选项里</div>
            <div className="text-xs text-muted-foreground">例如在「🚀 节点选择」「🤖 AI 服务」里可以直接选这个分组</div>
          </div>
          <Switch
            checked={group.includeInGroupMembers !== false}
            onCheckedChange={(v) => setGroup({ ...group, includeInGroupMembers: v })}
          />
        </label>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button
          disabled={!!nameError || hasInvalidRegex(advanced)}
          onClick={() => onSave({ ...group, name, advanced: compactAdvanced(advanced) })}
        >
          保存
        </Button>
      </DialogFooter>
    </>
  );
}

export function GroupAdvancedDialog({
  meta,
  moduleId,
  value,
  onOpenChange,
  onSave,
}: {
  meta: Meta;
  moduleId: string | null;
  value: GroupAdvanced | undefined;
  onOpenChange: (open: boolean) => void;
  onSave: (moduleId: string, value: GroupAdvanced) => void;
}) {
  const module = meta.modules.find((m) => m.id === moduleId);
  return (
    <Dialog open={!!moduleId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        {module && (
          <GroupAdvancedForm
            key={module.id}
            meta={meta}
            moduleId={module.id}
            title={module.name}
            defaultType={module.groupType}
            initial={value ?? {}}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupAdvancedForm({
  meta,
  moduleId,
  title,
  defaultType,
  initial,
  onCancel,
  onSave,
}: {
  meta: Meta;
  moduleId: string;
  title: string;
  defaultType: GroupType;
  initial: GroupAdvanced;
  onCancel: () => void;
  onSave: (moduleId: string, value: GroupAdvanced) => void;
}) {
  const [value, setValue] = useState<GroupAdvanced>(initial);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>只让符合条件的节点出现在这个分流组里；不设置则包含全部节点。</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <GroupTypeFields
          type={value.groupType ?? defaultType}
          strategy={value.strategy}
          types={["select", "url-test", "fallback", "load-balance", "direct-first", "reject-first"]}
          onChange={({ groupType, strategy }) => setValue({ ...value, groupType, strategy })}
        />
        <NodeFilterFields meta={meta} value={value} onChange={setValue} />
      </div>
      <DialogFooter>
        <Button variant="ghost" className="mr-auto" onClick={() => onSave(moduleId, {})}>
          恢复默认
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button disabled={hasInvalidRegex(value)} onClick={() => onSave(moduleId, compactAdvanced(value))}>
          保存
        </Button>
      </DialogFooter>
    </>
  );
}
