import { ArrowLeftIcon, LayoutTemplateIcon, ListTreeIcon, PlusIcon, RssIcon, ScrollTextIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useModuleCategories } from "@/hooks/use-module-categories";
import { PageHeader, Panel, PanelTitle, Segmented } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeta, useTemplates } from "@/hooks/use-api";
import { formatRelative } from "@/lib/format";
import { TEMPLATE_LABEL } from "@/lib/modes";

const TABS = [
  { value: "builtin", label: "内置模板" },
  { value: "custom", label: "我的模板" },
] as const;

export function TemplatesPage() {
  const [tab, setTab] = useState<"builtin" | "custom">("builtin");
  const meta = useMeta();
  const custom = useTemplates();

  return (
    <>
      <PageHeader
        title="模板库"
        description="模板决定订阅里有哪些分流组和规则。修改「我的模板」会同步到所有使用它的订阅。"
        actions={
          <Button asChild>
            <Link href="/templates/new">
              <PlusIcon /> 新建模板
            </Link>
          </Button>
        }
      />
      <div className="mb-6">
        <Segmented value={tab} options={TABS} onChange={setTab} />
      </div>

      {tab === "builtin" ? (
        meta.data ? (
          <div className="grid gap-5 md:grid-cols-3">
            {meta.data.templates.map((t) => (
              <Panel key={t.id} className="flex flex-col">
                <PanelTitle icon={LayoutTemplateIcon} title={t.name} />
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <div className="mt-5 flex gap-5 text-sm">
                  <span className="flex items-center gap-1.5">
                    <ListTreeIcon className="size-3.5 text-muted-foreground" /> {t.groupCount} 分流组
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ScrollTextIcon className="size-3.5 text-muted-foreground" /> {t.ruleCount} 规则集
                  </span>
                </div>
                <div className="mt-auto flex gap-2 pt-6">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/templates/builtin/${t.id}`}>查看</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/templates/new?base=${t.id}`}>基于此新建</Link>
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <Skeleton className="h-48 rounded-3xl" />
        )
      ) : custom.isPending ? (
        <Skeleton className="h-48 rounded-3xl" />
      ) : custom.isError ? (
        <Panel className="text-destructive">加载失败：{custom.error.message}</Panel>
      ) : custom.data.length === 0 ? (
        <Panel className="py-16 text-center">
          <LayoutTemplateIcon className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-4 text-muted-foreground">还没有自己的模板</p>
          <p className="mt-1 text-sm text-muted-foreground">在内置模板基础上调整分流组、添加规则，保存后可被多个订阅共用。</p>
          <Button asChild className="mt-6">
            <Link href="/templates/new">
              <PlusIcon /> 新建模板
            </Link>
          </Button>
        </Panel>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {custom.data.map((t) => (
            <Link key={t.id} href={`/templates/${t.id}`} className="group">
              <Panel className="flex h-full flex-col transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="truncate font-medium">{t.name}</h3>
                  <Badge variant="outline" className="shrink-0 rounded-full">
                    基于{TEMPLATE_LABEL[t.base]}版
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted-foreground">{t.description || "无描述"}</p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5">
                    <ListTreeIcon className="size-3.5 text-muted-foreground" /> {t.groupCount} 分流组
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ScrollTextIcon className="size-3.5 text-muted-foreground" /> {t.customRuleCount} 自定义规则
                  </span>
                  <span className="flex items-center gap-1.5">
                    <RssIcon className="size-3.5 text-muted-foreground" /> {t.usedBy} 个订阅在用
                  </span>
                </div>
                <div className="mt-auto pt-5 text-xs text-muted-foreground">更新于 {formatRelative(t.updatedAt)}</div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function BuiltinTemplatePage({ id }: { id: string }) {
  const meta = useMeta();
  const template = meta.data?.templates.find((t) => t.id === id);

  const back = (
    <Link href="/templates" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" /> 模板库
    </Link>
  );

  if (!meta.data) return <Skeleton className="h-64 rounded-3xl" />;
  if (!template) return <PageHeader back={back} title="模板不存在" />;

  return (
    <>
      <PageHeader
        back={back}
        title={template.name}
        description={template.description}
        actions={
          <Button asChild>
            <Link href={`/templates/new?base=${template.id}`}>
              <PlusIcon /> 基于此新建
            </Link>
          </Button>
        }
      />
      <BuiltinGroups meta={meta.data} groups={template.groups} />
    </>
  );
}

function BuiltinGroups({ meta, groups }: { meta: NonNullable<ReturnType<typeof useMeta>["data"]>; groups: string[] }) {
  const categories = useModuleCategories(meta)
    .map((c) => ({ ...c, modules: c.modules.filter((m) => groups.includes(m.id)) }))
    .filter((c) => c.modules.length > 0);

  return (
    <div className="space-y-5">
      {categories.map((cat) => (
        <Panel key={cat.id}>
          <PanelTitle title={cat.name} description={`${cat.modules.length} 个分流组`} />
          <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {cat.modules.map((m) => (
              <li key={m.id}>
                <div className="font-medium">{m.name}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {m.description} · {m.ruleCount} 条规则
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
