"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  KeyRound,
  Rocket,
  Sun,
  MessageSquareQuote,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserCog,
  type LucideIcon,
  ChevronDown,
  ChevronsLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ClipboardList,
  Users,
  X,
  MessagesSquare,
  Contact,
  Send,
  MapPinned,
} from "lucide-react";
import { MENU_GROUPS } from "./DealTabs";
import { AskAIButton } from "./AskAI";
import { Logo, LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar, CountBadge } from "./ui";
import { NotificationBell } from "./NotificationBell";
import { LiveUpdates } from "./LiveUpdates";
import { cn } from "@/lib/utils";
import type { RoleT } from "@/lib/types";

const NAV: { href: string; label: string; icon: LucideIcon; roles: RoleT[]; section: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, roles: ["super_admin"], section: "Overview" },
  { href: "/today", label: "My Day", icon: Sun, roles: ["super_admin", "team_admin"], section: "Overview" },
  { href: "/inbox", label: "Inbox", icon: MessagesSquare, roles: ["super_admin", "team_admin"], section: "Overview" },
  { href: "/projects", label: "Projects", icon: Rocket, roles: ["super_admin", "team_admin"], section: "Work" },
  { href: "/clients", label: "Clients", icon: Users, roles: ["super_admin"], section: "Work" },
  { href: "/queries", label: "Queries", icon: FolderKanban, roles: ["super_admin", "team_admin"], section: "Work" },
  { href: "/leads", label: "Leads", icon: Contact, roles: ["super_admin", "team_admin"], section: "Work" },
  { href: "/finder", label: "Lead Finder", icon: MapPinned, roles: ["super_admin", "team_admin"], section: "Work" },
  { href: "/outreach", label: "Cold Email", icon: Send, roles: ["super_admin"], section: "Work" },
  { href: "/submissions", label: "Onboarding", icon: ClipboardList, roles: ["super_admin", "team_admin"], section: "Work" },
  { href: "/invoices", label: "Sales & Billing", icon: FileText, roles: ["super_admin"], section: "Business" },
  { href: "/reviews", label: "Reviews & Referrals", icon: MessageSquareQuote, roles: ["super_admin"], section: "Business" },
  { href: "/agent", label: "My Day", icon: Sun, roles: ["agent"], section: "Overview" },
  { href: "/agent/invoices", label: "Invoices", icon: FileText, roles: ["agent"], section: "Overview" },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["super_admin", "agent"], section: "Business" },
  { href: "/agent/users", label: "Admins & Team", icon: UserCog, roles: ["agent"], section: "Admin" },
  { href: "/agent/audit", label: "Audit Log", icon: ScrollText, roles: ["agent"], section: "Admin" },
  { href: "/agent/logins", label: "Login History", icon: ShieldCheck, roles: ["agent"], section: "Admin" },
  { href: "/agent/trash", label: "Recycle Bin", icon: Trash2, roles: ["agent"], section: "Admin" },
  { href: "/users", label: "Team & Users", icon: UserCog, roles: ["super_admin"], section: "Admin" },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["super_admin"], section: "Admin" },
];

const ROLE_LABEL: Record<RoleT, string> = { agent: "Owner", super_admin: "Super Admin", team_admin: "Team", client: "Client" };

export function AppShell({
  children,
  userName,
  userEmail,
  role,
  newSubmissions,
  unreadChats = 0,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  role: RoleT;
  newSubmissions: number;
  unreadChats?: number;
}) {
  const pathname = usePathname();
  const nav = NAV.filter((n) => n.roles.includes(role));
  const home = role === "super_admin" ? "/dashboard" : role === "agent" ? "/agent" : "/today";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("zx-sidebar") === "collapsed");
    } catch {}
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("zx-sidebar", next ? "collapsed" : "open");
    } catch {}
  }

  const sidebar = (isMobile: boolean) => {
    const mini = collapsed && !isMobile;
    return (
      <div className="flex h-full flex-col">
        <div className={cn("flex h-20 shrink-0 items-center px-5 [@media(max-height:820px)]:h-16", mini ? "justify-center px-2" : "justify-between")}>
          <Link href={home}>{mini ? <LogoMark className="h-9 w-auto" id="zx-mini" /> : <Logo />}</Link>
          {isMobile ? (
            <button onClick={() => setMobileOpen(false)} className="btn btn-ghost btn-sm px-2" aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
          ) : (
            !mini && (
              <button onClick={toggleCollapsed} className="btn btn-ghost btn-sm px-2" aria-label="Collapse sidebar">
                <ChevronsLeft className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        <nav className={cn("no-scrollbar mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto pb-3 [@media(max-height:820px)]:space-y-0.5 [@media(max-height:760px)]:pb-1", mini ? "px-2" : "px-4")}>
          {nav.map((item, i) => {
            // Small group titles (Overview, Work, Business, Admin) so the menu reads in chunks.
            const newSection = item.section !== nav[i - 1]?.section;
            const under = (p: string) => pathname === p || pathname.startsWith(p + "/");
            const active = item.href === "/agent" ? pathname === "/agent" : under(item.href) || (MENU_GROUPS[item.href] || []).some(under);
            const Icon = item.icon;
            return (
              <div key={item.href}>
                {newSection &&
                  (mini ? (
                    i > 0 && <div className="mx-3 my-3 border-t border-line" />
                  ) : (
                    <>
                      {/* Very short screens: a thin line instead of the title, so everything still fits. */}
                      <div className={cn("px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted/70 [@media(max-height:760px)]:hidden", i > 0 ? "pt-4 [@media(max-height:820px)]:pt-2" : "pt-1")}>
                        {item.section}
                      </div>
                      {i > 0 && <div className="mx-4 my-2 hidden border-t border-line [@media(max-height:760px)]:block" />}
                    </>
                  ))}
                <Link
                href={item.href}
                title={mini ? item.label : undefined}
                className={cn(
                  // Shrinks on short screens so the whole menu always fits without scrolling.
                  "group flex items-center gap-3.5 rounded-full px-4 py-2.5 text-[15px] font-medium transition [@media(max-height:900px)]:py-2 [@media(max-height:760px)]:py-1.5 [@media(max-height:760px)]:text-sm",
                  mini && "justify-center px-0",
                  active
                    ? "bg-navy text-white shadow-lg shadow-navy/20 dark:bg-white dark:text-navy"
                    : "text-fg/75 hover:bg-surface-2 hover:text-heading"
                )}
              >
                <span className="relative shrink-0">
                  <Icon className="h-5 w-5" />
                  {mini && item.href === "/inbox" && <CountBadge n={unreadChats} corner />}
                </span>
                {!mini && <span className="flex-1 truncate">{item.label}</span>}
                {!mini && item.href === "/inbox" && <CountBadge n={unreadChats} />}
                {!mini && item.href === "/submissions" && newSubmissions > 0 && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", active ? "bg-white/20" : "bg-violet/10 text-violet")}>
                    {newSubmissions}
                  </span>
                )}
                {!mini && active && <ChevronRight className="h-4 w-4 opacity-80" />}
                </Link>
              </div>
            );
          })}
        </nav>

        {mini ? (
          <div className="p-3">
            <button onClick={toggleCollapsed} className="btn btn-ghost w-full px-0" aria-label="Expand sidebar">
              <ChevronsLeft className="h-4 w-4 rotate-180" />
            </button>
          </div>
        ) : (
          <div className="h-3" />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <LiveUpdates />
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed bottom-3 left-3 top-3 z-30 hidden overflow-hidden rounded-[28px] bg-sidebar shadow-[var(--card-shadow)] transition-[width] duration-200 dark:border dark:border-line lg:block",
          collapsed ? "w-[76px]" : "w-[264px]"
        )}
      >
        {sidebar(false)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-line bg-sidebar shadow-2xl">{sidebar(true)}</aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[88px]" : "lg:pl-[276px]")}>
        <Topbar
          onMenu={() => setMobileOpen(true)}
          userName={userName}
          userEmail={userEmail}
          role={role}
        />
        <main className="mx-auto max-w-[1600px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Topbar({
  onMenu,
  userName,
  userEmail,
  role,
}: {
  onMenu: () => void;
  userName: string;
  userEmail: string;
  role: RoleT;
}) {
  const isOwner = role === "super_admin";
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={onMenu} className="btn btn-outline px-2.5 lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>

        <form
          className={cn("relative hidden max-w-xl flex-1", isOwner && "md:block")}
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input h-11 rounded-full border-transparent pl-10 pr-14 shadow-[var(--card-shadow)]"
            placeholder="Search clients, invoices, projects..."
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
            Ctrl K
          </kbd>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {isOwner && (
            <>
              <Link href="/clients?new=1" className="btn btn-primary hidden sm:inline-flex">
                <Plus className="h-4 w-4" /> New Client
              </Link>
              <Link href="/invoices/new" className="btn btn-primary">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create Invoice</span>
              </Link>
            </>
          )}
          <ThemeToggle />
          {role !== "agent" && <AskAIButton />}
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2.5 rounded-xl p-1 pr-2 hover:bg-surface-2">
              <Avatar name={userName} className="h-9 w-9" />
              <div className="hidden text-left leading-tight xl:block">
                <div className="text-sm font-semibold text-heading">{userName}</div>
                <div className="text-xs text-muted">{ROLE_LABEL[role]}</div>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-muted xl:block" />
            </button>
            {menu && (
              <div className="card absolute right-0 mt-2 w-60 p-2 shadow-xl">
                <div className="border-b border-line px-3 pb-2 pt-1">
                  <div className="text-sm font-semibold text-heading">{userName}</div>
                  <div className="truncate text-xs text-muted">{userEmail}</div>
                </div>
                <Link href="/account" onClick={() => setMenu(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                  <KeyRound className="h-4 w-4" /> My account
                </Link>
                {isOwner && (
                  <Link href="/settings" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                )}
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
