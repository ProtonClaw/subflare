import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="sf-flare" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f97316" />
          <stop offset="0.55" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#sf-flare)" />
      <path
        d="M17.6 6.5c.4 3.1-1 4.9-2.7 6.6-1.6 1.6-3.4 3.3-3.4 6.2a5.5 5.5 0 0 0 11 .2c0-2.2-.9-3.6-1.9-4.8-.2 1.4-.9 2.4-2 2.8.8-3.6-.2-7.6-1-11Z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">SubFlare</span>
    </div>
  );
}
