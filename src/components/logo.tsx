import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 text-primary", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M17.6 6.5c.4 3.1-1 4.9-2.7 6.6-1.6 1.6-3.4 3.3-3.4 6.2a5.5 5.5 0 0 0 11 .2c0-2.2-.9-3.6-1.9-4.8-.2 1.4-.9 2.4-2 2.8.8-3.6-.2-7.6-1-11Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-7" />
      <span className="font-display text-lg font-semibold tracking-tight">SubFlare</span>
    </div>
  );
}
