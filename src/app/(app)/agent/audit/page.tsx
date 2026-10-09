import Link from "next/link";
import { Download, ScrollText } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { AGENT, pageUser } from "@/lib/session";
import { AuditLog } from "@/models/AuditLog";
import { EmptyState, PageHeader } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { auditFilter, type AuditFilters } from "@/lib/audit-query";
import { cn, serialize } from "@/lib/utils";

export const metadata = { title: "Owner · Audit Log" };

const PAGE = 100;
const ROLE: Record<string, string> = { agent: "Owner", super_admin: "Super Admin", team_admin: "Team", client: "Client", public: "Public link", system: "System" };

type Row = { _id: string; at: string; actorName?: string; actorRole?: string; action: string; method?: string; target?: string; details?: string; ip?: string };

/** Append-only history of every change, sign-in and deletion. Nobody can edit or delete it. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  await pageUser(AGENT);
  const sp = await searchParams;
  await dbConnect();
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const filter = auditFilter(sp);
  const [rows, total, people] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * PAGE).limit(PAGE).lean(),
    AuditLog.countDocuments(filter),
    AuditLog.distinct("actorName"),
  ]);
  const items = serialize<Row[]>(rows);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) p.set(k, String(v));
    return p.toString();
  };

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Who did what and when. Kept for 1 year; nobody can edit or delete it.">
        <a href={`/api/agent/audit?${qs({ page: "" })}`} className="btn btn-outline">
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </PageHeader>

      <form action="/agent/audit" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <label className="lg:col-span-2">
          <span className="label">Search</span>
          <input name="q" defaultValue={sp.q} className="input" placeholder="Invoice number, client, action..." />
        </label>
        <label>
          <span className="label">Who</span>
          <select name="who" defaultValue={sp.who || ""} className="input">
            <option value="">Everyone</option>
            {(people as string[]).filter(Boolean).sort().map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Type</span>
          <select name="type" defaultValue={sp.type || ""} className="input">
            <option value="">All actions</option>
            <option value="creates">Created</option>
            <option value="edits">Edited</option>
            <option value="deletes">Deleted</option>
          </select>
        </label>
        <label>
          <span className="label">From</span>
          <input type="date" name="from" defaultValue={sp.from} className="input" />
        </label>
        <label>
          <span className="label">To</span>
          <input type="date" name="to" defaultValue={sp.to} className="input" />
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
          <Link href="/agent/audit" className="btn btn-outline">Clear</Link>
          <button className="btn btn-primary">Apply filters</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={ScrollText} title="No activity found" text="Changes made by admins, team members and clients appear here." />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>On</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id}>
                    <td className="whitespace-nowrap text-xs text-muted">
                      <LocalTime iso={r.at} />
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="font-semibold text-heading">{r.actorName}</div>
                      <div className="text-xs text-muted">{ROLE[r.actorRole || ""] || r.actorRole}</div>
                    </td>
                    <td className="min-w-[200px]">
                      <span className={cn("font-medium", r.method === "DELETE" ? "text-red-500" : "text-fg")}>{r.action}</span>
                    </td>
                    <td className="max-w-[220px] truncate" title={r.target}>
                      {r.target || "—"}
                    </td>
                    <td className="max-w-[320px] truncate text-xs text-muted" title={r.details}>
                      {r.details || "—"}
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{r.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {total.toLocaleString()} entries · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/agent/audit?${qs({ page: page - 1 })}`} className="btn btn-outline btn-sm">Newer</Link>}
            {page < pages && <Link href={`/agent/audit?${qs({ page: page + 1 })}`} className="btn btn-outline btn-sm">Older</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
