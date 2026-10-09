import Link from "next/link";
import { CircleDollarSign, ExternalLink, FileText, Hourglass, Wallet } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { AGENT, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Invoice } from "@/models/Invoice";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { StatusTabs } from "@/components/Filters";
import { INVOICE_STATUSES } from "@/lib/constants";
import { formatDate, formatMoney, isOverdue, serialize } from "@/lib/utils";
import type { InvoiceT } from "@/lib/types";

export const metadata = { title: "Owner · Invoices" };

/** Every invoice, view only. Opening one shows the invoice as the client sees it. */
export default async function AgentInvoices({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageUser(AGENT);
  const sp = await searchParams;
  await dbConnect();
  const [docs, all, settings] = await Promise.all([
    Invoice.find(sp.status ? { status: sp.status } : {}).sort({ issueDate: -1 }).limit(500).select("invoiceNumber publicId clientSnapshot issueDate dueDate status currency totals").lean(),
    Invoice.find({ status: { $nin: ["Draft", "Cancelled"] } }).select("status currency totals").lean<{ status: string; currency: string; totals?: { total?: number; paid?: number; balance?: number } }[]>(),
    getSettings(),
  ]);
  const invoices = serialize<InvoiceT[]>(docs);
  const cur = settings.defaultCurrency;
  const inCur = all.filter((i) => i.currency === cur);
  const sum = (k: "total" | "paid" | "balance") => inCur.reduce((s, i) => s + (i.totals?.[k] || 0), 0);
  const counts: Record<string, number> = { All: 0 };
  for (const i of await Invoice.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])) {
    counts[i._id] = i.n;
    counts.All! += i.n;
  }

  return (
    <div>
      <PageHeader title="Invoices" subtitle="All invoices, view only. Totals are in your default currency." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={FileText} label="Invoices issued" value={all.length} tone="blue" />
        <StatCard icon={CircleDollarSign} label="Total invoiced" value={formatMoney(sum("total"), cur)} tone="violet" />
        <StatCard icon={Wallet} label="Received" value={formatMoney(sum("paid"), cur)} tone="green" />
        <StatCard icon={Hourglass} label="Outstanding" value={formatMoney(sum("balance"), cur)} tone={sum("balance") > 0 ? "red" : "slate"} />
      </div>
      <div className="mb-4">
        <StatusTabs basePath="/agent/invoices" current={sp.status} options={[...INVOICE_STATUSES]} params={sp} counts={counts} />
      </div>
      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices" />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Billed to</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const balance = i.totals?.balance || 0;
                  const late = isOverdue(i.dueDate, balance <= 0 || ["Draft", "Cancelled"].includes(i.status));
                  return (
                    <tr key={i._id}>
                      <td className="font-semibold text-heading">{i.invoiceNumber}</td>
                      <td className="whitespace-nowrap">{i.clientSnapshot?.company || i.clientSnapshot?.name}</td>
                      <td className="whitespace-nowrap text-muted">{formatDate(i.issueDate)}</td>
                      <td className={`whitespace-nowrap ${late ? "font-semibold text-red-500" : "text-muted"}`}>{formatDate(i.dueDate)}</td>
                      <td className="whitespace-nowrap font-semibold">{formatMoney(i.totals?.total, i.currency)}</td>
                      <td className={`whitespace-nowrap ${balance > 0 ? "font-semibold text-red-500" : "text-muted"}`}>{formatMoney(balance, i.currency)}</td>
                      <td>
                        <Badge status={late ? "Overdue" : i.status} />
                      </td>
                      <td>
                        {!["Draft", "Cancelled"].includes(i.status) && (
                          <Link href={`/invoice/${i.publicId}`} target="_blank" className="btn btn-ghost btn-sm" title="View invoice">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        )}
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
