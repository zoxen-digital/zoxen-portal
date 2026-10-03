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
          <div className="overflow-x-auto p-3">
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
        )}
      </div>
    </div>
  );
}
