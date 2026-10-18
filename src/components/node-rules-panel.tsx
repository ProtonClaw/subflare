import { ArrowDownUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Panel, PanelTitle, Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPortableToMihomo, regexError, type NodeRules, type NodeSort } from "../../worker/lib/node-rules";

const SORT_OPTIONS: ReadonlyArray<{ value: NodeSort; label: string }> = [
  { value: "none", label: "保持原顺序" },
  { value: "region", label: "按地区" },
  { value: "name", label: "按名称" },
];

const MAX_RULES = 20;

export function NodeRulesPanel({
  value,
  onChange,
  clientPulled,
}: {
  value: NodeRules;
  onChange: (value: NodeRules) => void;
  /** Some URL sources are pulled by the client through proxy-providers. */
  clientPulled: boolean;
}) {
  const setRule = (index: number, patch: Partial<NodeRules["rename"][number]>) =>
    onChange({ ...value, rename: value.rename.map((r, i) => (i === index ? { ...r, ...patch } : r)) });

  return (
    <Panel>
      <PanelTitle
        icon={ArrowDownUpIcon}
        title="节点处理"
        description="生成订阅时自动改名和排序，机场新增的节点也会套用。"
      />
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">排序</span>
          <Segmented value={value.sort} options={SORT_OPTIONS} onChange={(sort) => onChange({ ...value, sort })} />
          {value.sort === "region" && <span className="text-xs text-muted-foreground">香港 → 台湾 → 日本 → 新加坡 → 韩国 → 美国 → …</span>}
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">改名规则（正则查找替换，按顺序执行，支持 $1 引用分组）</div>
          {value.rename.map((rule, index) => {
            const error = regexError(rule.pattern);
            const clientOnlyWarning = clientPulled && !error && rule.pattern && !isPortableToMihomo(rule.pattern);
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    className="font-mono text-xs"
                    placeholder="查找，例如：\s*\|\s*\d+(\.\d+)?x$"
                    value={rule.pattern}
                    maxLength={200}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => setRule(index, { pattern: e.target.value })}
                  />
                  <Input
                    className="font-mono text-xs"
                    placeholder="替换为，留空即删除"
                    value={rule.replace}
                    maxLength={200}
                    onChange={(e) => setRule(index, { replace: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    aria-label="删除规则"
                    onClick={() => onChange({ ...value, rename: value.rename.filter((_, i) => i !== index) })}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                {clientOnlyWarning && (
                  <p className="text-xs text-muted-foreground">
                    含前瞻 / 反向引用，Mihomo 不支持，客户端拉取的节点不会套用这条规则。
                  </p>
                )}
              </div>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            disabled={value.rename.length >= MAX_RULES}
            onClick={() => onChange({ ...value, rename: [...value.rename, { pattern: "", replace: "" }] })}
          >
            <PlusIcon /> 添加规则
          </Button>
        </div>

        {clientPulled && (value.rename.length > 0 || value.sort !== "none") && (
          <p className="text-xs text-muted-foreground">
            「客户端拉取」的节点由客户端改名（需要 Mihomo 内核，写入 proxy-providers 的 override），不参与排序。
          </p>
        )}
      </div>
    </Panel>
  );
}
