import Link from "next/link";
import { Types } from "mongoose";
import { FileSpreadsheet } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { STAFF, pageUser } from "@/lib/session";
import { LeadList } from "@/models/LeadList";
import { Lead } from "@/models/Lead";
import { EmptyState, PageHeader } from "@/components/ui";
import { SearchBox } from "@/components/Filters";
import { LeadsTable, SheetActions, UploadLeadsButton, type LeadRow } from "@/components/LeadSheets";
import { cn, escapeRegex } from "@/lib/utils";

export const metadata = { title: "Leads" };

const PAGE = 100;

/** Filter tabs: what to work on next. */
const FILTERS: { key: string; label: string; match: (today: Date) => Record<string, unknown> }[] = [
  { key: "all", label: "All", match: () => ({}) },
  { key: "todo", label: "Not messaged", match: () => ({ messaged: false }) },
  { key: "waiting", label: "Messaged, no reply", match: () => ({ messaged: true, status: "Pending" }) },
  { key: "responded", label: "Responded", match: () => ({ status: "Responded" }) },
  { key: "interested", label: "Interested", match: () => ({ status: "Interested" }) },
  { key: "later", label: "Call later", match: () => ({ status: "Call later" }) },
  { key: "due", label: "Follow up today", match: (t) => ({ status: "Call later", followUpAt: { $lte: t } }) },
  { key: "no", label: "Not interested", match: () => ({ status: "Not interested" }) },
];

type Doc = Omit<LeadRow, "_id" | "messagedAt" | "followUpAt" | "query" | "extra"> & { _id: unknown; messagedAt?: Date | null; followUpAt?: Date | null; query?: unknown; extra?: Record<string, string> };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ list?: string; f?: string; q?: string; page?: string }> }) {
  await pageUser(STAFF);
  const sp = await searchParams;
  await dbConnect();

  const lists = await LeadList.find().sort({ createdAt: -1 }).lean<{ _id: unknown; name: string; source: string; createdByName?: string; createdAt: Date }[]>();
  const listId = sp.list && lists.some((l) => String(l._id) === sp.list) ? sp.list : lists[0] ? String(lists[0]._id) : "";
  const current = lists.find((l) => String(l._id) === listId);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const base = listId ? { list: new Types.ObjectId(listId) } : { list: null };

  const [counts, perList] = await Promise.all([
    Promise.all(FILTERS.map((f) => Lead.countDocuments({ ...base, ...f.match(endOfToday) }))),
    Lead.aggregate([{ $group: { _id: "$list", n: { $sum: 1 }, done: { $sum: { $cond: ["$messaged", 1, 0] } } } }]),
  ]);
  const listCount = new Map(perList.map((x: { _id: unknown; n: number; done: number }) => [String(x._id), x]));

  const filter = FILTERS.find((f) => f.key === sp.f) || FILTERS[0]!;
  const match: Record<string, unknown> = { ...base, ...filter.match(endOfToday) };
  if (sp.q) {
    const rx = { $regex: escapeRegex(sp.q.slice(0, 80)), $options: "i" };
    match.$or = [{ name: rx }, { company: rx }, { title: rx }, { email: rx }, { phone: rx }, { location: rx }, { notes: rx }];
  }
  const page = Math.max(1, Number(sp.page) || 1);
  const [docs, total] = await Promise.all([
    Lead.find(match)
      .sort(filter.key === "due" || filter.key === "later" ? { followUpAt: 1 } : { createdAt: 1 })
      .skip((page - 1) * PAGE)
      .limit(PAGE)
      .lean<Doc[]>(),
    Lead.countDocuments(match),
  ]);
  const rows: LeadRow[] = docs.map((d) => ({
    _id: String(d._id),
    name: d.name,
    company: d.company,
    title: d.title,
    email: d.email,
    phone: d.phone,
    linkedin: d.linkedin,
    instagram: d.instagram || "",
    location: d.location,
    website: d.website,
    extra: d.extra || {},
    messaged: d.messaged,
    messagedAt: d.messagedAt ? new Date(d.messagedAt).toISOString() : null,
    messagedBy: d.messagedBy,
    status: d.status,
    followUpAt: d.followUpAt ? new Date(d.followUpAt).toISOString() : null,
    notes: d.notes,
    query: d.query ? String(d.query) : null,
  }));

  const href = (p: { f?: string; page?: number; list?: string }) => {
    const q = new URLSearchParams();
    q.set("list", p.list ?? listId);
    if (p.f && p.f !== "all") q.set("f", p.f);
    if (sp.q && p.list === undefined) q.set("q", sp.q);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    return `/leads?${q.toString()}`;
  };
  const totalAll = counts[0] || 0;
  const messaged = totalAll - (counts[1] || 0);
  const pct = totalAll ? Math.round((messaged / totalAll) * 100) : 0;

  return (
    <div>
      <PageHeader title="Leads" subtitle="Upload a sheet from LinkedIn or anywhere, tick who you have messaged, and track who replied.">
        <UploadLeadsButton lists={lists.map((l) => ({ _id: String(l._id), name: l.name }))} />
      </PageHeader>

      {lists.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileSpreadsheet} title="No lead sheets yet" text="Upload a CSV or Excel file. Name, company, title, email, phone and LinkedIn URL are picked up automatically." />
        </div>
      ) : (
        <>
          {/* Sheets */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {lists.map((l) => {
              const c = listCount.get(String(l._id));
              const active = String(l._id) === listId;
              return (
                <Link
                  key={String(l._id)}
                  href={href({ list: String(l._id) })}
                  className={cn("shrink-0 rounded-2xl border px-4 py-2.5 transition", active ? "border-brand bg-brand/5" : "border-line bg-surface hover:border-brand/40")}
                >
                  <div className={cn("max-w-[220px] truncate text-sm font-semibold", active ? "text-brand dark:text-[#8f9bff]" : "text-heading")}>{l.name}</div>
                  <div className="text-xs text-muted">
                    {l.source} · {c?.done || 0}/{c?.n || 0} messaged
                  </div>
                </Link>
              );
            })}
          </div>

          {current && (
            <div className="card mb-4 flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-heading">{current.name}</div>
                <div className="text-xs text-muted">
                  {current.source} · uploaded {new Date(current.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {current.createdByName ? ` by ${current.createdByName}` : ""}
                </div>
                <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted">
                  {messaged} of {totalAll} messaged ({pct}%) · {counts[3]! + counts[4]!} replied · {counts[4]} interested
                </div>
              </div>
              <SheetActions id={listId} name={current.name} />
            </div>
          )}

          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {FILTERS.map((f, i) => (
                <Link
                  key={f.key}
                  href={href({ f: f.key })}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                    filter.key === f.key ? "bg-brand-gradient text-white" : f.key === "due" && counts[i] ? "bg-red-50 text-red-600 dark:bg-red-500/10" : "bg-surface-2 text-muted hover:text-fg"
                  )}
                >
                  {f.label} ({counts[i]})
                </Link>
              ))}
            </div>
            <div className="lg:ml-auto lg:w-72">
              <SearchBox action="/leads" defaultValue={sp.q} placeholder="Search name, company, email..." hidden={{ list: listId, f: sp.f }} />
            </div>
          </div>

          <div className="card overflow-hidden">
            {rows.length === 0 ? (
              <EmptyState icon={FileSpreadsheet} title="Nothing here" text={sp.q ? "No leads match your search." : "No leads in this view."} />
            ) : (
              <LeadsTable initial={rows} />
            )}
          </div>

          {total > PAGE && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted">
                {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={href({ f: filter.key, page: page - 1 })} className="btn btn-outline btn-sm">
                    Previous
                  </Link>
                )}
                {page * PAGE < total && (
                  <Link href={href({ f: filter.key, page: page + 1 })} className="btn btn-outline btn-sm">
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
