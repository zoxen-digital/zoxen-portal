import Link from "next/link";
import { FilePen, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";

/** Quotes and contracts share one menu item; these tabs switch between them. */
export function DealTabs({ current }: { current: "quotes" | "contracts" }) {
  const tabs = [
    { key: "quotes", href: "/quotes", label: "Quotes", hint: "Price offers", icon: FilePen },
    { key: "contracts", href: "/contracts", label: "Contracts", hint: "Agreements to sign", icon: FileSignature },
  ] as const;
  return (
    <div className="mb-5 inline-flex rounded-2xl border border-line bg-surface p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            current === t.key ? "bg-brand-gradient text-white shadow" : "text-muted hover:text-fg"
          )}
        >
          <t.icon className="h-4 w-4" />
          {t.label}
          <span className={cn("hidden text-xs font-normal sm:inline", current === t.key ? "text-white/75" : "text-muted")}>· {t.hint}</span>
        </Link>
      ))}
    </div>
  );
}
