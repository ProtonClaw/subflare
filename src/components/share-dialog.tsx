import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { useMemo } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { subscriptionUrl } from "@/lib/api";
import { copyText } from "@/lib/clipboard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  token: string;
  title?: string;
};

export function ShareDialog({ open, onOpenChange, name, token, title = "订阅链接" }: Props) {
  const url = subscriptionUrl(token);
  const qr = useMemo(() => renderSVG(url, { border: 2, pixelSize: 6 }), [url]);
  const importUrl = (scheme: string) =>
    `${scheme}://install-config?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>在 Clash Verge / Mihomo Party / Stash 等客户端中导入此链接。请勿泄露给他人。</DialogDescription>
        </DialogHeader>

        <div className="mx-auto w-52 overflow-hidden rounded-xl border bg-white p-2 shadow-sm [&_svg]:h-auto [&_svg]:w-full">
          <div dangerouslySetInnerHTML={{ __html: qr }} />
        </div>

        <button
          type="button"
          onClick={() => copyText(url, "订阅链接已复制")}
          className="group flex w-full items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-left font-mono text-xs transition-colors hover:bg-muted"
        >
          <span className="min-w-0 flex-1 truncate">{url}</span>
          <CopyIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </button>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => copyText(url, "订阅链接已复制")}>
            <CopyIcon /> 复制链接
          </Button>
          <Button variant="outline" asChild>
            <a href={importUrl("clash")}>
              <ExternalLinkIcon /> 导入 Clash
            </a>
          </Button>
          <Button variant="outline" asChild className="col-span-2">
            <a href={importUrl("stash")}>
              <ExternalLinkIcon /> 导入 Stash
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
