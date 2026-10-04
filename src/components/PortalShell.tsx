"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  FileSignature,
  FileText,
  Gift,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquareQuote,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { LiveUpdates } from "./LiveUpdates";
import { Avatar } from "./ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/portal/onboarding", label: "Onboarding", icon: ClipboardList },
  { href: "/portal/tickets", label: "Support", icon: LifeBuoy },
  { href: "/portal/documents", label: "Proposals", icon: FileSignature },
  { href: "/portal/invoices", label: "Invoices", icon: FileText },
  { href: "/portal/reports", label: "Reports", icon: BarChart3 },
  { href: "/portal/reviews", label: "Reviews", icon: MessageSquareQuote },
  { href: "/portal/referrals", label: "Refer & Earn", icon: Gift },
];

/** The four pages a client opens most; the rest sit behind "More" on phones. */
const TABS = ["/portal", "/portal/tickets", "/portal/documents", "/portal/invoices"];

export function PortalShell({ children, userName, company }: { children: React.ReactNode; userName: string; company: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href || pathname.startsWith("/portal/projects") : pathname.startsWith(n.href));
  const moreActive = NAV.some((n) => !TABS.includes(n.href) && isActive(n)) || pathname.startsWith("/portal/account");

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Close the phone menu after navigating, and stop the page scrolling behind it.
  useEffect(() => setSheet(false), [pathname]);
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <LiveUpdates />
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/portal" className="min-w-0 shrink">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <span className="hidden sm:block">
              <ThemeToggle />
            </span>
            <NotificationBell />
            <div className="relative hidden lg:block" ref={ref}>
              <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2">
                <Avatar name={userName} className="h-9 w-9" />
                <div className="text-left leading-tight">
                  <div className="text-sm font-semibold text-heading">{userName}</div>
                  <div className="max-w-[160px] truncate text-xs text-muted">{company}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted" />
              </button>
              {menu && (
                <div className="card absolute right-0 mt-2 w-56 p-2 shadow-xl">
                  <Link href="/portal/account" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                    <KeyRound className="h-4 w-4" /> My account
                  </Link>
                  <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setSheet(true)} className="btn btn-ghost px-2.5 lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Desktop: one centered row, same width as the page content */}
        <nav className="hidden border-t border-line lg:block">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-1 px-6 py-2">
            {NAV.map((n) => {
              const active = isActive(n);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
                    active ? "bg-brand-gradient text-white shadow" : "text-muted hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-16">{children}</main>

      {/* Phones & tablets: app-style bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((n) => TABS.includes(n.href)).map((n) => {
            const active = isActive(n);
            return (
              <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", active ? "text-brand dark:text-[#8f9bff]" : "text-muted")}>
                <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition", active && "bg-brand/10")}>
                  <n.icon className="h-5 w-5" />
                </span>
                {n.label}
              </Link>
            );
          })}
          <button onClick={() => setSheet(true)} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", moreActive ? "text-brand dark:text-[#8f9bff]" : "text-muted")}>
            <span className={cn("flex h-8 w-12 items-center justify-center rounded-full", moreActive && "bg-brand/10")}>
              <Menu className="h-5 w-5" />
            </span>
            More
          </button>
        </div>
      </nav>

      {/* Phones & tablets: full menu sheet */}
      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setSheet(false)} />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            style={{ animation: "zx-pop 0.18s ease-out" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={userName} className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-heading">{userName}</div>
                <div className="truncate text-xs text-muted">{company}</div>
              </div>
              <button onClick={() => setSheet(false)} className="btn btn-ghost px-2" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV.map((n) => {
                const active = isActive(n);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold",
                      active ? "border-brand bg-brand/10 text-brand dark:text-[#8f9bff]" : "border-line text-fg"
                    )}
                  >
                    <n.icon className="h-5 w-5 shrink-0" /> {n.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-line px-4 py-3">
              <span className="text-sm font-semibold text-heading">Appearance</span>
              <ThemeToggle />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href="/portal/account" className="flex items-center justify-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-fg">
                <KeyRound className="h-4 w-4" /> My account
              </Link>
              <button onClick={logout} className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-500">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
