import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, FolderKanban, Globe, KeyRound, Mail, MapPin, Phone, Plus, RefreshCcw, Rocket, Star } from "lucide-react";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { getSettings, teamNames } from "@/lib/settings";
import { mailEnabled } from "@/lib/mailer";
import { ADMIN, pageUser } from "@/lib/session";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { Meeting } from "@/models/Meeting";
import { Activity } from "@/models/Activity";
import { Avatar, Badge, CardHeader, EmptyState, InfoRow, StatCard } from "@/components/ui";
import { EditClientButton } from "@/components/ClientForm";
import { EditQueryButton, NewQueryButton } from "@/components/QueryForm";
import { DeleteButton, StatusSelect } from "@/components/actions";
import { NewProjectButton, ProgressBar, type TeamOption } from "@/components/ProjectForm";
import { NewUserButton, UserActions } from "@/components/UserForm";
import { MeetingsPanel } from "@/components/MeetingsPanel";
import { ActivityFeed } from "@/components/ProjectBits";
import { OPEN_STAGES, QUERY_STATUSES } from "@/lib/constants";
import { formatDate, formatMoney, isOverdue, serialize } from "@/lib/utils";
import type { ActivityT, ClientT, InvoiceT, MeetingT, ProjectT, QueryT, UserT } from "@/lib/types";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await pageUser(ADMIN);
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await dbConnect();

  const [doc, queryDocs, invoiceDocs, settings, projectDocs, userDocs, meetingDocs, activityDocs, teamDocs] = await Promise.all([
    Client.findById(id).lean(),
    Query.find({ client: id }).sort({ createdAt: -1 }).lean(),
    Invoice.find({ client: id }).sort({ createdAt: -1 }).lean(),
    getSettings(),
    Project.find({ client: id }).sort({ updatedAt: -1 }).lean(),
    User.find({ role: "client", client: id }).sort({ name: 1 }).lean(),
    Meeting.find({ client: id }).sort({ date: -1 }).limit(30).lean(),
    Activity.find({ client: id }).sort({ createdAt: -1 }).limit(15).lean(),
    User.find({ role: { $in: ["team_admin", "super_admin"] }, status: { $ne: "disabled" } }).sort({ name: 1 }).select("name title").lean(),
  ]);
  if (!doc) notFound();

  const client = serialize<ClientT>(doc);
  const queries = serialize<QueryT[]>(queryDocs);
  const invoices = serialize<InvoiceT[]>(invoiceDocs);
  const projects = serialize<ProjectT[]>(projectDocs);
  const portalUsers = serialize<UserT[]>(userDocs);
  const meetings = serialize<MeetingT[]>(meetingDocs);
  const activity = serialize<ActivityT[]>(activityDocs);
  const team = serialize<TeamOption[]>(teamDocs);
  const cur = settings.defaultCurrency;
  const active = invoices.filter((i) => !["Draft", "Cancelled"].includes(i.status));
  const invoiced = active.reduce((s, i) => s + (i.totals?.total || 0), 0);
  const paid = active.reduce((s, i) => s + (i.totals?.paid || 0), 0);
  const balance = active.reduce((s, i) => s + (i.totals?.balance || 0), 0);
  const clientOptions = [{ _id: client._id, name: client.name, company: client.company }];
  const activeProjects = projects.filter((p) => (OPEN_STAGES as string[]).includes(p.stage)).length;
  const revisionRounds = projects.reduce((s, p) => s + p.revisions.length, 0);
  const ratings = projects.map((p) => p.feedback?.rating).filter((r): r is number => !!r);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const services = [...new Set([...projects.map((p) => p.service), ...queries.map((q) => q.service)].filter(Boolean))] as string[];
  const mailOn = mailEnabled();
  const queryTeam = await teamNames();

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to clients
      </Link>

      <div className="card flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={client.name} className="h-14 w-14 text-base" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-heading">{client.name}</h1>
              <Badge status={client.status} />
            </div>
            <p className="text-sm text-muted">
              {client.company || "No company"} · Source: {client.source} · Added {formatDate(client.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditClientButton client={client} />
          <Link href={`/invoices/new?client=${client._id}`} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Create Invoice
          </Link>
          <DeleteButton
            url={`/api/clients/${client._id}`}
            redirectTo="/clients"
            confirmText={`Delete ${client.name}? Their queries, projects, meetings and portal logins will also be deleted. Invoices are kept.`}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-muted">Total invoiced</div>
          <div className="mt-1 text-2xl font-bold text-heading">{formatMoney(invoiced, cur)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted">Received</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(paid, cur)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted">Outstanding balance</div>
          <div className={`mt-1 text-2xl font-bold ${balance > 0 ? "text-red-500" : "text-heading"}`}>{formatMoney(balance, cur)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Rocket} label="Projects" value={`${activeProjects} active / ${projects.length}`} tone="blue" />
        <StatCard icon={RefreshCcw} label="Revision rounds" value={revisionRounds} tone="amber" />
        <StatCard icon={Star} label="Feedback" value={avgRating ? `${avgRating.toFixed(1)} / 5` : "—"} hint={ratings.length ? `${ratings.length} rating${ratings.length > 1 ? "s" : ""}` : "No ratings yet"} tone="violet" />
        <StatCard icon={KeyRound} label="Portal logins" value={portalUsers.length} hint={portalUsers.some((u) => u.status === "active") ? "Client has access" : "No active login yet"} tone="green" />
      </div>
      {services.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted">Services:</span>
          {services.map((s) => (
            <span key={s} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-fg">{s}</span>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <CardHeader
            icon={Rocket}
            title="Projects"
            subtitle="Live status the client sees on their portal"
            action={<NewProjectButton clients={clientOptions} team={team} clientId={client._id} label="New Project" outline />}
          />
          {projects.length === 0 ? (
            <EmptyState icon={Rocket} title="No projects yet" text="Create one to start tracking stages, approvals and revisions." />
          ) : (
            <ul className="divide-y divide-line px-5 pb-3">
              {projects.map((p) => {
                const late = isOverdue(p.dueDate, ["Live", "Completed"].includes(p.stage));
                return (
                  <li key={p._id}>
                    <Link href={`/projects/${p._id}`} className="group flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-heading group-hover:text-brand">{p.title}</div>
                        <div className="text-xs text-muted">
                          {p.service} · due {formatDate(p.dueDate)}
                          {p.issues.some((i) => i.status !== "Resolved") && <span className="ml-2 font-semibold text-amber-600">open issues</span>}
                        </div>
                      </div>
                      <div className="flex w-full items-center gap-2 sm:w-40">
                        <ProgressBar value={p.progress} />
                        <span className="w-9 text-right text-xs font-semibold">{p.progress}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={p.stage} />
                        {late && <Badge status="Overdue" />}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <CardHeader
            icon={KeyRound}
            title="Portal access"
            subtitle="Who at this client can log in"
            action={
              <NewUserButton
                clients={clientOptions}
                mailOn={mailOn}
                presetClient={{ _id: client._id, name: client.name, email: portalUsers.some((u) => u.email === client.email) ? "" : client.email }}
                label="Invite"
                outline
              />
            }
          />
          <div className="px-5 pb-5">
            {portalUsers.length === 0 ? (
              <p className="text-sm text-muted">No portal login yet. Invite the client so they can follow progress, approve work and see invoices.</p>
            ) : (
              <ul className="space-y-3">
                {portalUsers.map((u) => (
                  <li key={u._id} className="flex items-center gap-3">
                    <Avatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-heading">{u.name}</div>
                      <div className="truncate text-xs text-muted">{u.email}</div>
                    </div>
                    <Badge status={u.status === "invited" ? "Invited" : u.status === "disabled" ? "Disabled" : "Active"} />
                    <UserActions user={u} clients={clientOptions} isMe={false} mailOn={mailOn} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MeetingsPanel clientId={client._id} meetings={meetings} projects={projects.map((p) => ({ _id: p._id, title: p.title }))} />
        </div>
        <ActivityFeed items={activity} title="Recent activity" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-2 font-bold text-heading">Contact details</h2>
          <div className="divide-y divide-line">
            <InfoRow label="Email" value={client.email && <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Mail className="h-3.5 w-3.5" />{client.email}</a>} />
            <InfoRow label="Phone" value={client.phone && <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Phone className="h-3.5 w-3.5" />{client.phone}</a>} />
            <InfoRow
              label="Website"
              value={
                client.website && (
                  <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand">
                    <Globe className="h-3.5 w-3.5" />
                    {client.website}
                  </a>
                )
              }
            />
            <InfoRow label="Address" value={client.address && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{client.address}</span>} />
          </div>
          {client.notes && (
            <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm text-fg">
              <div className="mb-1 text-xs font-semibold text-muted">Notes</div>
              <p className="whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>

        <div className="card overflow-hidden xl:col-span-2">
          <CardHeader
            icon={FolderKanban}
            title="Queries & Projects"
            subtitle={`${queries.length} total`}
            action={<NewQueryButton clients={clientOptions} team={queryTeam} clientId={client._id} label="Add Query" outline />}
          />
          {queries.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No queries for this client yet" text="Log what the client asked for so the team can track it." />
          ) : (
            <div className="overflow-x-auto px-3 pb-3">
              <table className="table">
                <thead>
                  <tr>
                    <th>Query</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Due</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((q) => {
                    const late = isOverdue(q.dueDate, ["Completed", "Closed"].includes(q.status));
                    return (
                      <tr key={q._id}>
                        <td>
                          <div className="font-semibold text-heading">{q.title}</div>
                          <div className="text-xs text-muted">{q.service}</div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <StatusSelect url={`/api/queries/${q._id}`} value={q.status} options={QUERY_STATUSES} />
                            {late && <Badge status="Overdue" />}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">{q.assignedTo || "—"}</td>
                        <td className="whitespace-nowrap text-muted">{formatDate(q.dueDate)}</td>
                        <td className="whitespace-nowrap font-semibold">{q.amount ? formatMoney(q.amount, cur) : "—"}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <EditQueryButton query={q} clients={clientOptions} team={queryTeam} />
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

      <div className="card overflow-hidden">
        <CardHeader
          icon={FileText}
          title="Invoices"
          subtitle={`${invoices.length} total`}
          action={
            <Link href={`/invoices/new?client=${client._id}`} className="btn btn-outline">
              <Plus className="h-4 w-4" /> New Invoice
            </Link>
          }
        />
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices for this client yet" />
        ) : (
          <div className="overflow-x-auto px-3 pb-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i._id}>
                    <td>
                      <Link href={`/invoices/${i._id}`} className="font-semibold text-heading hover:text-brand">
                        {i.invoiceNumber}
                      </Link>
                    </td>
                    <td className="text-muted">{formatDate(i.issueDate)}</td>
                    <td className="text-muted">{formatDate(i.dueDate)}</td>
                    <td className="font-semibold">{formatMoney(i.totals?.total, i.currency)}</td>
                    <td className={i.totals?.balance ? "font-semibold text-red-500" : "text-muted"}>{formatMoney(i.totals?.balance, i.currency)}</td>
                    <td>
                      <Badge status={i.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
