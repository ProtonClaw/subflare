import { GlobeIcon, InfoIcon, KeyRoundIcon, LogOutIcon, PaletteIcon, TerminalIcon } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { PageHeader, Panel, PanelTitle, Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/use-api";

const THEMES = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
] as const;

const REPO_URL = "https://github.com/ProtonClaw/subflare";

function Command({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 font-mono text-xs">
      <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="overflow-x-auto whitespace-nowrap">{children}</span>
    </div>
  );
}

export function SettingsPage() {
  const { theme = "system", setTheme } = useTheme();
  const logout = useLogout();

  return (
    <>
      <PageHeader title="设置" />
      <div className="max-w-3xl space-y-5">
        <Panel>
          <PanelTitle
            icon={PaletteIcon}
            title="外观"
            description="界面配色"
            action={<Segmented value={theme as (typeof THEMES)[number]["value"]} options={THEMES} onChange={setTheme} />}
          />
        </Panel>

        <Panel>
          <PanelTitle icon={KeyRoundIcon} title="访问令牌" description="控制台只有一个管理员，使用部署时设置的令牌登录。" />
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">更换令牌后，所有已登录的浏览器都需要重新登录，订阅链接不受影响：</p>
            <Command>npx wrangler secret put SUBFLARE_TOKEN</Command>
            <Button variant="outline" onClick={() => logout.mutate()}>
              <LogOutIcon /> 退出登录
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelTitle icon={GlobeIcon} title="自定义域名" description="*.workers.dev 在中国大陆无法直接访问。" />
          <p className="text-sm text-muted-foreground">
            在 Cloudflare 控制台的 Workers → subflare → 设置 → 域和路由 中添加自定义域名，订阅链接会自动使用你访问控制台时的域名。
          </p>
        </Panel>

        <Panel>
          <PanelTitle icon={InfoIcon} title="关于" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>SubFlare 是运行在 Cloudflare Workers 上的 Clash / Mihomo 订阅转换与管理工具。</p>
            <p>
              以{" "}
              <a className="text-primary underline-offset-4 hover:underline" href={REPO_URL} target="_blank" rel="noreferrer">
                AGPL-3.0
              </a>{" "}
              协议开源，部分代码源自{" "}
              <a
                className="text-primary underline-offset-4 hover:underline"
                href="https://github.com/SubBoost/subboost"
                target="_blank"
                rel="noreferrer"
              >
                SubBoost
              </a>
              。
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
