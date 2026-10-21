import Link from "next/link";
import { FilePen, FileSignature, FileText, Gift, MessageSquareQuote, Package, Repeat, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: LucideIcon };

/**
 * Related pages share one menu item and switch with tabs.
 * Each tab is its own page, so only the open tab's data is loaded.
 */
const MONEY: Tab[] = [
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/quotes", label: "Quotes", icon: FilePen },
  { href: "/contracts", label: "Contracts", icon: FileSignature },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/packages", label: "Packages", icon: Package },
  { href: "/expenses", label: "Expenses", icon: Wallet },
];

const GROWTH: Tab[] = [
  { href: "/reviews", label: "Reviews", icon: MessageSquareQuote },
  { href: "/referrals", label: "Referrals", icon: Gift },
];

const GROUPS = { money: MONEY, growth: GROWTH };

export function SectionTabs({ group = "money", current }: { group?: string; current: string }) {
  const tabs = GROUPS[group as keyof typeof GROUPS] || MONEY;
  return (
    <nav className="-mx-1 mb-5 overflow-x-auto px-1 pb-1" aria-label="Section">
      <div className="inline-flex gap-1 rounded-full bg-surface p-1 shadow-[var(--card-shadow)]">
        {tabs.map((t) => {
          const active = current === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
                active ? "bg-navy text-white shadow dark:bg-white dark:text-navy" : "text-muted hover:bg-surface-2 hover:text-heading"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Menu item href -> other paths that should light it up. */
export const MENU_GROUPS: Record<string, string[]> = {
  "/invoices": MONEY.map((t) => t.href).filter((h) => h !== "/invoices"),
  "/reviews": ["/referrals"],
};
