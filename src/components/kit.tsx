import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 space-y-3">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1.5 text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-3xl bg-card p-6 shadow-[0_1px_2px_oklch(0_0_0/0.04)]", className)}>{children}</section>;
}

export function PanelTitle({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-medium">
          {Icon && (
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-3.5" />
            </span>
          )}
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-muted p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3 py-1 font-medium text-muted-foreground transition-colors",
            value === o.value ? "bg-primary text-primary-foreground shadow-sm" : "hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BigNumber({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("font-display text-4xl leading-none tracking-tight tabular-nums", className)}>{children}</div>;
}

export function StatusDot({ tone }: { tone: "ok" | "warn" | "error" }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone === "ok" && "bg-success",
        tone === "warn" && "bg-warning",
        tone === "error" && "bg-destructive"
      )}
    />
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all", value >= 0.9 ? "bg-destructive" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function BarChart({ data, height = "h-40" }: { data: Array<{ day: string; count: number }>; height?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const dense = data.length > 10;
  return (
    <div>
      <div className={cn("flex items-end", height, dense ? "gap-1" : "gap-3")}>
        {data.map((d, i) => (
          <Tooltip key={d.day}>
            <TooltipTrigger asChild>
              <div className="group flex h-full flex-1 flex-col justify-end">
                <div
                  className={cn(
                    "w-full rounded-md transition-colors",
                    d.count === 0
                      ? "bg-muted"
                      : i === data.length - 1
                        ? "bg-primary"
                        : "bg-primary/35 group-hover:bg-primary/60"
                  )}
                  style={{ height: d.count > 0 ? `${Math.max(6, (d.count / max) * 100)}%` : "4px" }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {d.day.slice(5).replace("-", "/")} · {d.count} 次
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className={cn("mt-2 flex text-[11px] text-muted-foreground tabular-nums", dense ? "gap-1" : "gap-3")}>
        {data.map((d, i) => (
          <div key={d.day} className="flex-1 text-center">
            {i === data.length - 1 ? "今天" : !dense || i % 5 === 0 ? d.day.slice(5).replace("-", "/") : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

const CLIENT_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-muted-foreground/40"];

export function ClientShare({ clients, total }: { clients: Array<{ client: string; count: number }>; total: number }) {
  if (total === 0) return null;
  const top = clients.slice(0, CLIENT_COLORS.length - 1);
  const rest = clients.slice(CLIENT_COLORS.length - 1).reduce((n, c) => n + c.count, 0);
  const items = rest > 0 ? [...top, { client: "其他", count: rest }] : top;
  return (
    <div className="space-y-3">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {items.map((c, i) => (
          <div key={c.client} className={CLIENT_COLORS[i]} style={{ width: `${(c.count / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {items.map((c, i) => (
          <div key={c.client} className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", CLIENT_COLORS[i])} />
            {c.client}
            <span className="text-muted-foreground tabular-nums">{Math.round((c.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
