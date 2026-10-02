import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, FolderKanban, Globe, Mail, MapPin, Phone, Plus } from "lucide-react";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Invoice } from "@/models/Invoice";
import { Avatar, Badge, CardHeader, EmptyState, InfoRow } from "@/components/ui";
import { EditClientButton } from "@/components/ClientForm";
import { EditQueryButton, NewQueryButton } from "@/components/QueryForm";
import { DeleteButton, StatusSelect } from "@/components/actions";
import { QUERY_STATUSES } from "@/lib/constants";
import { formatDate, formatMoney, isOverdue, serialize } from "@/lib/utils";
import type { ClientT, InvoiceT, QueryT } from "@/lib/types";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await dbConnect();

  const [doc, queryDocs, invoiceDocs, settings] = await Promise.all([
    Client.findById(id).lean(),
    Query.find({ client: id }).sort({ createdAt: -1 }).lean(),
    Invoice.find({ client: id }).sort({ createdAt: -1 }).lean(),
    getSettings(),
  ]);
  if (!doc) notFound();

  const client = serialize<ClientT>(doc);
  const queries = serialize<QueryT[]>(queryDocs);
  const invoices = serialize<InvoiceT[]>(invoiceDocs);
  const cur = settings.defaultCurrency;
  const active = invoices.filter((i) => !["Draft", "Cancelled"].includes(i.status));
  const invoiced = active.reduce((s, i) => s + (i.totals?.total || 0), 0);
  const paid = active.reduce((s, i) => s + (i.totals?.paid || 0), 0);
  const balance = active.reduce((s, i) => s + (i.totals?.balance || 0), 0);
  const clientOptions = [{ _id: client._id, name: client.name, company: client.company }];

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
            confirmText={`Delete ${client.name}? Their queries will also be deleted. Invoices are kept.`}
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
            action={<NewQueryButton clients={clientOptions} team={settings.teamMembers} clientId={client._id} label="Add Query" outline />}
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
                            <EditQueryButton query={q} clients={clientOptions} team={settings.teamMembers} />
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
