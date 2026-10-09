import Link from "next/link";
import { FilePen, FileSignature, FileText, Package, Repeat, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; hint: string; icon: LucideIcon };

/** Pages that share one menu item; tabs switch between them. */
const GROUPS: Record<string, Tab[]> = {
  deals: [
    { href: "/quotes", label: "Quotes", hint: "Price offers", icon: FilePen },
    { href: "/contracts", label: "Contracts", hint: "Agreements to sign", icon: FileSignature },
  ],
  billing: [
    { href: "/invoices", label: "Invoices", hint: "Bills sent", icon: FileText },
    { href: "/recurring", label: "Recurring", hint: "Monthly auto bills", icon: Repeat },
    { href: "/packages", label: "Packages", hint: "Ready services", icon: Package },
    { href: "/expenses", label: "Expenses", hint: "What we pay", icon: Wallet },
  ],
};

export function SectionTabs({ group, current }: { group: keyof typeof GROUPS; current: string }) {
  return (
    <div className="mb-5 flex max-w-full overflow-x-auto">
      <div className="inline-flex shrink-0 rounded-2xl border border-line bg-surface p-1">
        {GROUPS[group]!.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4",
              current === t.href ? "bg-brand-gradient text-white shadow" : "text-muted hover:text-fg"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            <span className={cn("hidden text-xs font-normal md:inline", current === t.href ? "text-white/75" : "text-muted")}>· {t.hint}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Menu item href -> other paths that should light it up. */
export const MENU_GROUPS: Record<string, string[]> = {
  "/quotes": ["/contracts"],
  "/invoices": ["/recurring", "/packages", "/expenses"],
};
