import Link from "next/link";
import { FileText, FolderKanban, Search, Users } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Invoice } from "@/models/Invoice";
import { Avatar, Badge, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { escapeRegex, formatMoney, serialize } from "@/lib/utils";
import type { ClientT, InvoiceT, QueryT } from "@/lib/types";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  if (!term) {
    return (
      <div>
        <PageHeader title="Search" />
        <div className="card">
          <EmptyState icon={Search} title="Type something to search" text="Search across clients, queries and invoices." />
        </div>
      </div>
    );
  }

  await dbConnect();
  const rx = { $regex: escapeRegex(term), $options: "i" };
  const [clientDocs, queryDocs, invoiceDocs] = await Promise.all([
    Client.find({ $or: [{ name: rx }, { company: rx }, { email: rx }, { phone: rx }, { website: rx }] }).limit(20).lean(),
    Query.find({ $or: [{ title: rx }, { service: rx }, { description: rx }, { assignedTo: rx }] }).limit(20).populate("client", "name").lean(),
    Invoice.find({ $or: [{ invoiceNumber: rx }, { "clientSnapshot.name": rx }, { "clientSnapshot.company": rx }, { "requirement.summary": rx }] }).limit(20).lean(),
  ]);
  const clients = serialize<ClientT[]>(clientDocs);
  const queries = serialize<QueryT[]>(queryDocs);
  const invoices = serialize<InvoiceT[]>(invoiceDocs);
  const none = !clients.length && !queries.length && !invoices.length;

  return (
    <div className="space-y-6">
      <PageHeader title={`Results for "${term}"`} subtitle={`${clients.length + queries.length + invoices.length} match(es)`} />
      {none && (
        <div className="card">
          <EmptyState icon={Search} title="No matches" text="Try a client name, invoice number, email or phone." />
        </div>
      )}
      {clients.length > 0 && (
        <div className="card">
          <CardHeader icon={Users} title="Clients" />
          <ul className="divide-y divide-line px-5 pb-3">
            {clients.map((c) => (
              <li key={c._id}>
                <Link href={`/clients/${c._id}`} className="flex items-center gap-3 py-3">
                  <Avatar name={c.name} />
                  <div className="flex-1">
                    <div className="font-semibold text-heading">{c.name}</div>
                    <div className="text-xs text-muted">{[c.company, c.email, c.phone].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Badge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {queries.length > 0 && (
        <div className="card">
          <CardHeader icon={FolderKanban} title="Queries & Projects" />
          <ul className="divide-y divide-line px-5 pb-3">
            {queries.map((qq) => {
              const c = qq.client as ClientT | null;
              return (
                <li key={qq._id}>
                  <Link href={c ? `/clients/${c._id}` : "/queries"} className="flex items-center gap-3 py-3">
                    <div className="flex-1">
                      <div className="font-semibold text-heading">{qq.title}</div>
                      <div className="text-xs text-muted">
                        {c?.name} · {qq.service} {qq.assignedTo ? `· ${qq.assignedTo}` : ""}
                      </div>
                    </div>
                    <Badge status={qq.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {invoices.length > 0 && (
        <div className="card">
          <CardHeader icon={FileText} title="Invoices" />
          <ul className="divide-y divide-line px-5 pb-3">
            {invoices.map((i) => (
              <li key={i._id}>
                <Link href={`/invoices/${i._id}`} className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <div className="font-semibold text-heading">{i.invoiceNumber}</div>
                    <div className="text-xs text-muted">{i.clientSnapshot?.name}</div>
                  </div>
                  <div className="font-semibold">{formatMoney(i.totals.total, i.currency)}</div>
                  <Badge status={i.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
