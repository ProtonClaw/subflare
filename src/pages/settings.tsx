import {
  ArchiveIcon,
  DownloadIcon,
  GlobeIcon,
  InfoIcon,
  KeyRoundIcon,
  Loader2Icon,
  LogOutIcon,
  PaletteIcon,
  TerminalIcon,
  UploadIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle, Segmented } from "@/components/kit";
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
import { useImportBackup, useLogout } from "@/hooks/use-api";
import type { BackupFile } from "@/lib/api";

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

function BackupPanel() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const importBackup = useImportBackup();

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      if (parsed?.format !== "subflare-backup/v1") throw new Error();
      setPending(parsed);
    } catch {
      toast.error("不是有效的 SubFlare 备份文件");
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    importBackup.mutate(pending, {
      onSuccess: (r) => toast.success(`已恢复 ${r.subscriptions} 个订阅、${r.templates} 个模板`),
      onError: (e) => toast.error(e.message),
      onSettled: () => setPending(null),
    });
  };

  return (
    <Panel>
      <PanelTitle icon={ArchiveIcon} title="备份与恢复" description="导出全部订阅和模板，可恢复到本实例或另一个 SubFlare（Cloudflare 或 Docker 版）。" />
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          备份文件包含机场订阅链接和订阅令牌，请妥善保管。恢复会按 ID 覆盖同名订阅和模板，订阅链接保持不变；拉取记录不在备份内。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/backup" download>
              <DownloadIcon /> 导出备份
            </a>
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={importBackup.isPending}>
            {importBackup.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} 从备份恢复
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && !importBackup.isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>从备份恢复？</AlertDialogTitle>
            <AlertDialogDescription>
              将导入 {pending?.subscriptions.length ?? 0} 个订阅、{pending?.templates.length ?? 0} 个模板
              {pending ? `（备份于 ${new Date(pending.exportedAt).toLocaleString("zh-CN")}）` : ""}。ID 相同的现有数据会被覆盖，其他数据保持不变。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>恢复</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
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

        <BackupPanel />

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
