import Link from "next/link";
import { Eye, FileText, Plus, CheckCircle2, ExternalLink, Pencil } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/actions";
import { SearchBox, StatusTabs } from "@/components/Filters";
import { escapeRegex, formatDate, formatMoney, isOverdue, serialize } from "@/lib/utils";
import type { InvoiceT } from "@/lib/types";

export const metadata = { title: "Invoices" };

const TABS = ["Draft", "Unpaid", "Partially Paid", "Paid", "Outstanding", "Overdue", "Cancelled"];

type SP = Promise<{ q?: string; status?: string }>;

export default async function InvoicesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await dbConnect();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filter: Record<string, unknown> = {};
  if (sp.status === "Outstanding") {
    filter.status = { $nin: ["Draft", "Cancelled"] };
    filter["totals.balance"] = { $gt: 0 };
  } else if (sp.status === "Overdue") {
    filter.status = { $nin: ["Draft", "Cancelled", "Paid"] };
    filter["totals.balance"] = { $gt: 0 };
    filter.dueDate = { $lt: today };
  } else if (sp.status) {
    filter.status = sp.status;
  }
  if (sp.q) {
    const rx = { $regex: escapeRegex(sp.q), $options: "i" };
    filter.$or = [{ invoiceNumber: rx }, { "clientSnapshot.name": rx }, { "clientSnapshot.company": rx }, { "requirement.summary": rx }];
  }

  const [docs, statusAgg] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
    Invoice.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const invoices = serialize<InvoiceT[]>(docs);
  const counts: Record<string, number> = { All: 0 };
  for (const s of statusAgg as { _id: string; n: number }[]) {
    counts[s._id] = s.n;
    counts.All! += s.n;
  }

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Create, share and track payment on every invoice.">
        <Link href="/invoices/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> Create Invoice
        </Link>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs basePath="/invoices" current={sp.status} options={TABS} params={sp} counts={counts} />
        <SearchBox action="/invoices" defaultValue={sp.q} placeholder="Search invoice # or client..." hidden={{ status: sp.status }} />
      </div>

      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices found"
            text="Generate an invoice and send the link straight to your client."
            action={<Link href="/invoices/new" className="btn btn-primary">Create invoice</Link>}
          />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Client activity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const late = isOverdue(i.dueDate, i.totals.balance <= 0 || ["Paid", "Cancelled", "Draft"].includes(i.status));
                  return (
                    <tr key={i._id}>
                      <td>
                        <Link href={`/invoices/${i._id}`} className="font-bold text-heading hover:text-brand">
                          {i.invoiceNumber}
                        </Link>
                      </td>
                      <td>
                        <div className="font-medium text-fg">{i.clientSnapshot?.name}</div>
                        <div className="text-xs text-muted">{i.clientSnapshot?.company}</div>
                      </td>
                      <td className="whitespace-nowrap text-muted">{formatDate(i.issueDate)}</td>
                      <td className={`whitespace-nowrap ${late ? "font-semibold text-red-500" : "text-muted"}`}>{formatDate(i.dueDate)}</td>
                      <td className="whitespace-nowrap font-semibold text-heading">{formatMoney(i.totals.total, i.currency)}</td>
                      <td className={`whitespace-nowrap font-semibold ${i.totals.balance > 0 ? "text-red-500" : "text-muted"}`}>
                        {formatMoney(i.totals.balance, i.currency)}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Badge status={i.status} />
                          {late && <Badge status="Overdue" />}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        {i.confirmedAt ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                          </span>
                        ) : i.viewCount ? (
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" /> Viewed {i.viewCount}x
                          </span>
                        ) : (
                          "Not viewed"
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {i.status !== "Draft" && i.status !== "Cancelled" && (
                            <>
                              <CopyButton text={`/invoice/${i.publicId}`} label="Link" className="btn-sm" />
                              <a href={`/invoice/${i.publicId}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm px-2" title="Open client view">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </>
                          )}
                          <Link href={`/invoices/${i._id}/edit`} className="btn btn-ghost btn-sm px-2" title="Edit invoice">
                            <Pencil className="h-4 w-4" />
                          </Link>
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
