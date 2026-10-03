import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { STAFF, pageUser } from "@/lib/session";
import { ticketScope } from "@/lib/tickets";
import { Ticket } from "@/models/Ticket";
import { Client } from "@/models/Client";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { SearchBox, StatusTabs } from "@/components/Filters";
import { NewTicketButton } from "@/components/TicketForms";
import { OPEN_TICKET_STATUSES, TICKET_STATUSES } from "@/lib/constants";
import { escapeRegex, formatDate, isOverdue, serialize } from "@/lib/utils";
import type { ClientT, TicketT, UserT } from "@/lib/types";

export const metadata = { title: "Support Tickets" };

type SP = Promise<{ q?: string; status?: string }>;

export default async function TicketsPage({ searchParams }: { searchParams: SP }) {
  const user = await pageUser(STAFF);
  const isOwner = user.role === "super_admin";
  const sp = await searchParams;
  await dbConnect();
  const scope = await ticketScope(user);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filter: Record<string, unknown> = { ...scope };
  const status = sp.status || "Active";
  // "Everything" shows every ticket, whatever its status.
  if (status === "Active") filter.status = { $in: OPEN_TICKET_STATUSES };
  else if (status === "Overdue") Object.assign(filter, { status: { $in: OPEN_TICKET_STATUSES }, dueDate: { $lt: today } });
  else if (status !== "Everything") filter.status = status;
  if (sp.q) {
    const rx = { $regex: escapeRegex(sp.q), $options: "i" };
    filter.$and = [{ $or: [{ title: rx }, { number: rx }, { description: rx }] }];
  }

  const myProjects = isOwner ? {} : { team: user.id };
  const [docs, all, clientDocs, projectDocs, teamDocs] = await Promise.all([
    Ticket.find(filter).sort({ updatedAt: -1 }).limit(500).populate("client", "name company").populate("assignee", "name").lean(),
    Ticket.find(scope).select("status dueDate").lean<{ status: string; dueDate?: Date }[]>(),
    Project.find(myProjects).select("client").lean<{ client: unknown }[]>().then((ps) =>
      Client.find(isOwner ? {} : { _id: { $in: ps.map((p) => p.client) } }).sort({ name: 1 }).select("name company").lean()
    ),
    Project.find(myProjects).select("title client").lean(),
    User.find({ role: { $in: ["team_admin", "super_admin"] }, status: "active" }).sort({ name: 1 }).select("name").lean(),
  ]);
  const tickets = serialize<TicketT[]>(docs);
  const counts: Record<string, number> = { Everything: all.length, Active: 0, Overdue: 0 };
  for (const t of all) {
    counts[t.status] = (counts[t.status] || 0) + 1;
    if (OPEN_TICKET_STATUSES.includes(t.status)) {
      counts.Active!++;
      if (t.dueDate && new Date(t.dueDate) < today) counts.Overdue!++;
    }
  }
  const clients = serialize<ClientT[]>(clientDocs).map((c) => ({ _id: c._id, name: c.company ? `${c.name} (${c.company})` : c.name }));
  const projects = serialize<{ _id: string; title: string; client: string }[]>(projectDocs);
  const team = serialize<{ _id: string; name: string }[]>(teamDocs);

  return (
    <div>
      <PageHeader title="Support Tickets" subtitle="Bugs, change requests and questions after launch. Every ticket has an owner, a priority and a due date.">
        <NewTicketButton clients={clients} projects={projects} team={team} isOwner={isOwner} uploads={!!process.env.BLOB_READ_WRITE_TOKEN} />
      </PageHeader>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs basePath="/tickets" allLabel="Active" current={sp.status} options={[...TICKET_STATUSES, "Overdue", "Everything"]} params={sp} counts={counts} />
        <SearchBox action="/tickets" defaultValue={sp.q} placeholder="Search tickets..." hidden={{ status: sp.status }} />
      </div>
      <div className="card overflow-hidden">
        {tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No tickets here" text="When clients report a problem or ask for a change, it shows up here." />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const c = t.client as ClientT | null;
                  const a = t.assignee as UserT | null;
                  const late = isOverdue(t.dueDate, !OPEN_TICKET_STATUSES.includes(t.status));
                  return (
                    <tr key={t._id}>
                      <td>
                        <Link href={`/tickets/${t._id}`} className="group block min-w-[220px]">
                          <div className="text-xs font-semibold text-muted">{t.number}</div>
                          <div className="font-semibold text-heading group-hover:text-brand">{t.title}</div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-muted">{c ? c.company || c.name : "—"}</td>
                      <td className="whitespace-nowrap">{t.type}</td>
                      <td><Badge status={t.priority} /></td>
                      <td><Badge status={t.status} /></td>
                      <td className="whitespace-nowrap">{a?.name || <span className="text-red-500">Unassigned</span>}</td>
                      <td className={`whitespace-nowrap ${late ? "font-semibold text-red-500" : "text-muted"}`}>{formatDate(t.dueDate)}</td>
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
