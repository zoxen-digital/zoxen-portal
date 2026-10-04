import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { Invoice } from "@/models/Invoice";
import { Badge, EmptyState } from "@/components/ui";
import { formatDate, formatMoney, isOverdue, serialize } from "@/lib/utils";
import type { InvoiceT } from "@/lib/types";

export const metadata = { title: "Invoices" };

export default async function PortalInvoices() {
  const user = await pageUser(["client"]);
  await dbConnect();
  const invoices = serialize<InvoiceT[]>(
    await Invoice.find({ client: user.clientId, status: { $nin: ["Draft", "Cancelled"] } })
      .sort({ issueDate: -1 })
      .select("invoiceNumber publicId issueDate dueDate status currency totals requirement")
      .lean()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[28px]">Invoices</h1>
        <p className="mt-1 text-sm text-muted">Open any invoice to see the full details, download the PDF or confirm payment.</p>
      </div>
      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" />
        ) : (
          <>
          {/* Phones: one card per invoice */}
          <ul className="divide-y divide-line sm:hidden">
            {invoices.map((i) => {
              const balance = i.totals?.balance || 0;
              const late = isOverdue(i.dueDate, balance <= 0);
              return (
                <li key={i._id}>
                  <Link href={`/invoice/${i.publicId}`} target="_blank" className="block p-4 active:bg-surface-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-heading">{i.invoiceNumber}</div>
                        {i.requirement?.summary && <div className="truncate text-xs text-muted">{i.requirement.summary}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge status={i.status} />
                        {late && <Badge status="Overdue" />}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted">Total</div>
                        <div className="font-semibold text-heading">{formatMoney(i.totals?.total, i.currency)}</div>
                      </div>
                      <div>
                        <div className="text-muted">Balance</div>
                        <div className={balance > 0 ? "font-semibold text-red-500" : "font-semibold text-heading"}>{formatMoney(balance, i.currency)}</div>
                      </div>
                      <div>
                        <div className="text-muted">Due</div>
                        <div className={late ? "font-semibold text-red-500" : "font-semibold text-heading"}>{formatDate(i.dueDate)}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand dark:text-[#8f9bff]">
                      Open invoice <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto p-3 sm:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
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
                  const late = isOverdue(i.dueDate, balance <= 0);
                  return (
                    <tr key={i._id}>
                      <td>
                        <div className="font-semibold text-heading">{i.invoiceNumber}</div>
                        {i.requirement?.summary && <div className="max-w-[240px] truncate text-xs text-muted">{i.requirement.summary}</div>}
                      </td>
                      <td className="whitespace-nowrap text-muted">{formatDate(i.issueDate)}</td>
                      <td className={`whitespace-nowrap ${late ? "font-semibold text-red-500" : "text-muted"}`}>{formatDate(i.dueDate)}</td>
                      <td className="whitespace-nowrap font-semibold">{formatMoney(i.totals?.total, i.currency)}</td>
                      <td className={`whitespace-nowrap ${balance > 0 ? "font-semibold text-red-500" : "text-muted"}`}>{formatMoney(balance, i.currency)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Badge status={i.status} />
                          {late && <Badge status="Overdue" />}
                        </div>
                      </td>
                      <td>
                        <Link href={`/invoice/${i.publicId}`} target="_blank" className="btn btn-outline btn-sm">
                          Open <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
