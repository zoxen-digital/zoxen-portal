"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, FileText, KeyRound, LayoutGrid, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { Avatar } from "./ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/portal/invoices", label: "Invoices", icon: FileText },
];

export function PortalShell({ children, userName, company }: { children: React.ReactNode; userName: string; company: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/portal" className="shrink-0">
            <Logo />
          </Link>
          <nav className="ml-2 hidden gap-1 sm:flex">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.href || pathname.startsWith("/portal/projects") : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active ? "bg-brand-gradient text-white shadow" : "text-muted hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <div className="relative" ref={ref}>
              <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2">
                <Avatar name={userName} className="h-9 w-9" />
                <div className="hidden text-left leading-tight md:block">
                  <div className="text-sm font-semibold text-heading">{userName}</div>
                  <div className="max-w-[160px] truncate text-xs text-muted">{company}</div>
                </div>
                <ChevronDown className="hidden h-4 w-4 text-muted md:block" />
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
          </div>
        </div>
        <nav className="flex gap-1 border-t border-line px-4 py-2 sm:hidden">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href || pathname.startsWith("/portal/projects") : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium", active ? "bg-brand-gradient text-white" : "text-muted")}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
    </div>
  );
}
