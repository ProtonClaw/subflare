import { LogOutIcon, PlusIcon, RssIcon } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ShareDialog } from "@/components/share-dialog";
import { SubscriptionCard } from "@/components/subscription-card";
import { SubscriptionEditor } from "@/components/subscription-editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLogout, useSubscriptions } from "@/hooks/use-api";
import type { SubscriptionDetail } from "@/lib/api";

const REPO_URL = "https://github.com/ProtonClaw/subflare";

export function Dashboard() {
  const subs = useSubscriptions();
  const logout = useLogout();
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [created, setCreated] = useState<SubscriptionDetail | null>(null);

  const openEditor = (id: string | null) => setEditor({ open: true, id });
  const onSaved = (detail: SubscriptionDetail, isNew: boolean) => {
    setEditor((e) => ({ ...e, open: false }));
    if (isNew) setCreated(detail);
  };

  return (
    <div className="relative min-h-svh">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-aurora" />

      <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.2-3.1-.1-.4-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
                </svg>
              </a>
            </Button>
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => logout.mutate()} aria-label="退出登录">
                  <LogOutIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>退出登录</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">我的订阅</h1>
            <p className="mt-1 text-sm text-muted-foreground">合并机场订阅、套用分流规则，生成一条 Clash / Mihomo 链接。</p>
          </div>
          {subs.data && subs.data.length > 0 && (
            <Button onClick={() => openEditor(null)}>
              <PlusIcon /> 新建订阅
            </Button>
          )}
        </div>

        {subs.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-60 rounded-2xl" />
            ))}
          </div>
        ) : subs.isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            加载失败：{subs.error.message}
          </div>
        ) : subs.data.length === 0 ? (
          <EmptyState onCreate={() => openEditor(null)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subs.data.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} onEdit={() => openEditor(sub.id)} />
            ))}
          </div>
        )}
      </main>

      <SubscriptionEditor
        open={editor.open}
        editingId={editor.id}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        onSaved={onSaved}
      />

      {created && (
        <ShareDialog
          open
          onOpenChange={(o) => !o && setCreated(null)}
          name={created.name}
          token={created.token}
          title="订阅已生成"
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed bg-card/50 px-6 py-16 text-center backdrop-blur">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <RssIcon className="size-6" />
        </div>
        <h2 className="mt-5 text-lg font-semibold">创建你的第一个订阅</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          粘贴机场订阅链接或节点，选一个规则模板，SubFlare 会生成一条可直接导入 Clash Verge / Mihomo 的订阅链接。
        </p>
        <Button className="mt-6" size="lg" onClick={onCreate}>
          <PlusIcon /> 新建订阅
        </Button>
      </div>
    </div>
  );
}
