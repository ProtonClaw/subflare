import { ArrowRightIcon, KeyRoundIcon, Loader2Icon, TerminalIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/use-api";

export function LoginScreen({ configured }: { configured: boolean }) {
  const [token, setToken] = useState("");
  const login = useLogin();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (token.trim()) login.mutate(token.trim());
  };

  return (
    <div className="relative grid min-h-svh place-items-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">SubFlare</h1>
          <p className="mt-3 text-muted-foreground">运行在 Cloudflare 上的 Clash / Mihomo 订阅管理</p>
        </div>

        <div className="rounded-3xl border bg-card p-7">
          {configured ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <KeyRoundIcon className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  placeholder="访问令牌"
                  className="h-12 rounded-2xl pl-10"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  aria-invalid={login.isError || undefined}
                />
              </div>
              {login.isError && <p className="text-sm text-destructive">{login.error.message}</p>}
              <Button type="submit" className="h-12 w-full rounded-2xl" disabled={!token.trim() || login.isPending}>
                {login.isPending ? <Loader2Icon className="animate-spin" /> : <ArrowRightIcon />}
                进入控制台
              </Button>
            </form>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium">尚未配置访问令牌</p>
              <p className="text-muted-foreground">在项目目录执行以下命令设置一个至少 8 位的令牌，然后刷新页面：</p>
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 font-mono text-xs">
                <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
                npx wrangler secret put SUBFLARE_TOKEN
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
