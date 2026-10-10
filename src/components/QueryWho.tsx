import Link from "next/link";
import { Avatar } from "./ui";
import type { ClientT, QueryT } from "@/lib/types";

/** Who a query is for: the linked client, or the website lead's contact details. */
export function QueryWho({ q }: { q: QueryT }) {
  const c = q.client as ClientT | null;
  if (c && typeof c === "object") {
    return (
      <Link href={`/clients/${c._id}`} className="flex items-center gap-3">
        <Avatar name={c.name} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-heading hover:text-brand">{c.name}</div>
          <div className="truncate text-xs text-muted">{c.company}</div>
        </div>
      </Link>
    );
  }
  const l = q.lead;
  if (l?.name) {
    return (
      <div className="flex items-center gap-3">
        <Avatar name={l.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-heading">{l.company || l.name}</span>
            <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Lead</span>
          </div>
          <div className="truncate text-xs text-muted">
            {l.email ? (
              <a href={`mailto:${l.email}`} className="hover:underline">
                {l.email}
              </a>
            ) : null}
            {l.email && l.phone ? " · " : ""}
            {l.phone ? (
              <a href={`tel:${l.phone}`} className="hover:underline">
                {l.phone}
              </a>
            ) : null}
            {!l.email && !l.phone && l.company ? l.name : ""}
          </div>
        </div>
      </div>
    );
  }
  return <span className="text-muted">Deleted client</span>;
}

/** One-line label for lists (My Day, search, dashboard). */
export function queryWhoText(q: { client?: unknown; lead?: QueryT["lead"] }) {
  const c = q.client as { name?: string; company?: string } | null;
  if (c && typeof c === "object") return c.company || c.name || "Client";
  if (q.lead?.name) return `${q.lead.company || q.lead.name} (lead)`;
  return "Deleted client";
}
