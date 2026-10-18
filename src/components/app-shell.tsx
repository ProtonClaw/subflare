import {
  ChevronsUpDownIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  ListIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useLogout, useSubscriptions } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "总览",
    items: [
      { href: "/", label: "仪表盘", icon: LayoutDashboardIcon, match: (p) => p === "/" },
      { href: "/pull-logs", label: "拉取记录", icon: HistoryIcon, match: (p) => p === "/pull-logs" },
    ],
  },
  {
    group: "订阅",
    items: [
      {
        href: "/subscriptions",
        label: "我的订阅",
        icon: ListIcon,
        match: (p) => p.startsWith("/subscriptions") && p !== "/subscriptions/new",
      },
      { href: "/subscriptions/new", label: "新建订阅", icon: PlusIcon, match: (p) => p === "/subscriptions/new" },
      { href: "/templates", label: "模板库", icon: LayoutTemplateIcon, match: (p) => p.startsWith("/templates") },
    ],
  },
  {
    group: "系统",
    items: [{ href: "/settings", label: "设置", icon: SettingsIcon, match: (p) => p === "/settings" }],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [path] = useLocation();
  const subs = useSubscriptions();
  const logout = useLogout();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-3">
        <Link href="/" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="px-3 pb-2 text-xs font-medium text-muted-foreground">{section.group}</div>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = item.match(path);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground [&>svg]:text-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <item.icon className="size-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/subscriptions" && subs.data && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {subs.data.length}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-1 border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground">
                A
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">管理员</span>
                <span className="block truncate text-xs text-muted-foreground">{window.location.host}</span>
              </span>
              <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={onNavigate}>
                <SettingsIcon /> 设置
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate()}>
              <LogOutIcon /> 退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 overflow-hidden border-r bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="打开菜单">
          <MenuIcon />
        </Button>
        <Logo />
        <ThemeToggle />
      </header>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">导航</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
