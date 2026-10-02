import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
import { EditQueryButton, NewQueryButton, type ClientOption } from "@/components/QueryForm";
import { DeleteButton, StatusSelect } from "@/components/actions";
import { SearchBox, StatusTabs } from "@/components/Filters";
import { QUERY_STATUSES } from "@/lib/constants";
import { escapeRegex, formatDate, formatMoney, isOverdue, serialize } from "@/lib/utils";
import type { ClientT, QueryT } from "@/lib/types";

export const metadata = { title: "Queries & Projects" };

type SP = Promise<{ q?: string; status?: string; assigned?: string }>;

export default async function QueriesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await dbConnect();
  const settings = await getSettings();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filter: Record<string, unknown> = {};
  if (sp.status === "Overdue") {
    filter.status = { $in: ["Pending", "In Progress"] };
    filter.dueDate = { $lt: today };
  } else if (sp.status) {
    filter.status = sp.status;
  }
  if (sp.assigned) filter.assignedTo = sp.assigned;
  if (sp.q) {
    const rx = { $regex: escapeRegex(sp.q), $options: "i" };
    const matchingClients = await Client.find({ $or: [{ name: rx }, { company: rx }] }).select("_id").lean();
    filter.$or = [{ title: rx }, { service: rx }, { description: rx }, { client: { $in: matchingClients.map((c) => c._id) } }];
  }

  const [docs, clientDocs, statusAgg, overdueCount] = await Promise.all([
    Query.find(filter).sort({ createdAt: -1 }).limit(500).populate("client", "name company").lean(),
    Client.find().sort({ name: 1 }).select("name company").lean(),
    Query.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Query.countDocuments({ status: { $in: ["Pending", "In Progress"] }, dueDate: { $lt: today } }),
  ]);

  const queries = serialize<QueryT[]>(docs);
  const clients = serialize<ClientOption[]>(clientDocs);
  const counts: Record<string, number> = { All: 0, Overdue: overdueCount };
  for (const s of statusAgg as { _id: string; n: number }[]) {
    counts[s._id] = s.n;
    counts.All! += s.n;
  }
  const team = settings.teamMembers;
  const cur = settings.defaultCurrency;

  return (
    <div>
      <PageHeader title="Queries & Projects" subtitle="Track every client request from pending to closed, with an owner and a due date.">
        <NewQueryButton clients={clients} team={team} />
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs basePath="/queries" current={sp.status} options={[...QUERY_STATUSES, "Overdue"]} params={sp} counts={counts} />
        <div className="flex flex-col gap-2 sm:flex-row">
          {team.length > 0 && (
            <form action="/queries" className="flex gap-2">
              {sp.status && <input type="hidden" name="status" value={sp.status} />}
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              <select name="assigned" defaultValue={sp.assigned || ""} className="input w-44">
                <option value="">All team members</option>
                {team.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <button className="btn btn-outline">Filter</button>
            </form>
          )}
          <SearchBox action="/queries" defaultValue={sp.q} placeholder="Search query or client..." hidden={{ status: sp.status, assigned: sp.assigned }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {queries.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No queries found"
            text={clients.length === 0 ? "Add a client first, then log their query here." : "Create a query to start tracking work."}
            action={clients.length === 0 ? <Link href="/clients?new=1" className="btn btn-primary">Add client</Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Query / Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assigned To</th>
                  <th>Due</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {queries.map((q) => {
                  const c = q.client as ClientT | null;
                  const late = isOverdue(q.dueDate, ["Completed", "Closed"].includes(q.status));
                  return (
                    <tr key={q._id}>
                      <td>
                        {c ? (
                          <Link href={`/clients/${c._id}`} className="flex items-center gap-3">
                            <Avatar name={c.name} />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-heading hover:text-brand">{c.name}</div>
                              <div className="truncate text-xs text-muted">{c.company}</div>
                            </div>
                          </Link>
                        ) : (
                          <span className="text-muted">Deleted client</span>
                        )}
                      </td>
                      <td>
                        <div className="max-w-[260px] truncate font-medium text-fg" title={q.title}>
                          {q.title}
                        </div>
                        <div className="text-xs text-muted">{q.service}</div>
                        {q.notes && <div className="mt-0.5 max-w-[260px] truncate text-xs text-amber-600" title={q.notes}>Note: {q.notes}</div>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <StatusSelect url={`/api/queries/${q._id}`} value={q.status} options={QUERY_STATUSES} />
                          {late && <Badge status="Overdue" />}
                        </div>
                      </td>
                      <td>
                        <Badge status={q.priority || "Medium"} />
                      </td>
                      <td className="whitespace-nowrap">{q.assignedTo || <span className="text-red-500">Unassigned</span>}</td>
                      <td className={`whitespace-nowrap ${late ? "font-semibold text-red-500" : "text-muted"}`}>{formatDate(q.dueDate)}</td>
                      <td className="whitespace-nowrap font-semibold text-heading">{q.amount ? formatMoney(q.amount, cur) : "—"}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <EditQueryButton query={q} clients={clients} team={team} />
                          <DeleteButton small url={`/api/queries/${q._id}`} confirmText="Delete this query?" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
