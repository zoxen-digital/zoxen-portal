import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, Wallet } from "lucide-react";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Invoice } from "@/models/Invoice";
import { Badge, CardHeader, InfoRow } from "@/components/ui";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { InvoiceActions, RemovePaymentButton, ShareCard } from "@/components/InvoiceActions";
import { formatDate, formatMoney, serialize } from "@/lib/utils";
import type { InvoiceT } from "@/lib/types";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!isValidObjectId(id)) notFound();
  await dbConnect();
  const [doc, settings] = await Promise.all([Invoice.findById(id).lean(), getSettings()]);
  if (!doc) notFound();
  const invoice = serialize<InvoiceT>(doc);
  const clientId = typeof invoice.client === "string" ? invoice.client : invoice.client?._id;

  return (
    <div className="space-y-6">
      <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-heading sm:text-[28px]">{invoice.invoiceNumber}</h1>
            <Badge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            For{" "}
            <Link href={`/clients/${clientId}`} className="font-semibold text-fg hover:text-brand">
              {invoice.clientSnapshot?.name}
            </Link>
            {invoice.clientSnapshot?.company ? ` · ${invoice.clientSnapshot.company}` : ""} · Created {formatDate(invoice.createdAt)}
          </p>
        </div>
        <InvoiceActions invoice={invoice} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="order-2 space-y-6 xl:order-1">
          <InvoiceDocument invoice={invoice} settings={settings} />
        </div>

        <div className="order-1 space-y-6 xl:order-2">
          <ShareCard invoice={invoice} companyName={settings.companyName} created={created === "1"} />

          <div className="card p-5">
            <h2 className="mb-2 font-bold text-heading">Summary</h2>
            <div className="divide-y divide-line">
              <InfoRow label="Total" value={formatMoney(invoice.totals.total, invoice.currency)} />
              <InfoRow label="Paid" value={<span className="text-emerald-600">{formatMoney(invoice.totals.paid, invoice.currency)}</span>} />
              <InfoRow
                label="Balance"
                value={<span className={invoice.totals.balance > 0 ? "text-red-500" : ""}>{formatMoney(invoice.totals.balance, invoice.currency)}</span>}
              />
              <InfoRow label="Due date" value={formatDate(invoice.dueDate)} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-bold text-heading">Client activity</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Eye className="h-4 w-4 text-muted" />
                {invoice.viewCount ? (
                  <span>
                    Viewed <b>{invoice.viewCount}</b> time(s), last on {formatDate(invoice.lastViewedAt)}
                  </span>
                ) : (
                  <span className="text-muted">Client has not opened the link yet</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`h-4 w-4 ${invoice.confirmedAt ? "text-emerald-500" : "text-muted"}`} />
                {invoice.confirmedAt ? (
                  <span>
                    Client confirmed on <b>{formatDate(invoice.confirmedAt)}</b>
                  </span>
                ) : (
                  <span className="text-muted">Not confirmed by client yet</span>
                )}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <CardHeader icon={Wallet} title="Payments" subtitle={`${invoice.payments.length} recorded`} />
            {invoice.payments.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line px-5 pb-3">
                {invoice.payments.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 py-3 text-sm">
                    <div className="flex-1">
                      <div className="font-semibold text-heading">{formatMoney(p.amount, invoice.currency)}</div>
                      <div className="text-xs text-muted">
                        {formatDate(p.date)} · {p.method}
                        {p.note ? ` · ${p.note}` : ""}
                      </div>
                    </div>
                    <RemovePaymentButton invoiceId={invoice._id} index={i} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
