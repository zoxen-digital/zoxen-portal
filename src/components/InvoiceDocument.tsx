import { CalendarDays, Clock3, FileText, Landmark, Mail, Phone, Globe, BadgeCheck, Percent, Receipt, PlusCircle } from "lucide-react";
import { Logo } from "./Logo";
import { Badge } from "./ui";
import { formatDate, formatMoney, formatNumber, isOverdue } from "@/lib/utils";
import type { InvoiceT, SettingsT } from "@/lib/types";

/** The invoice as the client sees it. Always rendered on a light "paper" surface. */
export function InvoiceDocument({ invoice, settings }: { invoice: InvoiceT; settings: SettingsT }) {
  const t = invoice.totals;
  const cur = invoice.currency;
  const n = (v: number) => formatMoney(v, cur);
  const c = invoice.clientSnapshot || { name: "" };
  const req = invoice.requirement;
  const pd = invoice.paymentDetails || {};
  const hasBank = pd.bankName || pd.accountName || pd.accountNumber || pd.iban;
  const overdue = isOverdue(invoice.dueDate, t.balance <= 0 || ["Paid", "Cancelled", "Draft"].includes(invoice.status));
  const status = overdue ? "Overdue" : invoice.status;
  const reqTags = [
    req?.websites ? `${req.websites} Website${req.websites > 1 ? "s" : ""}` : "",
    req?.pages ? `${req.pages} Pages` : "",
    ...(req?.tags || []),
  ].filter(Boolean);

  return (
    <div data-invoice-doc className="paper print-plain @container mx-auto w-full max-w-[860px] rounded-2xl border border-line bg-surface p-5 text-fg shadow-xl shadow-brand/5 sm:p-10">
      {/* Header */}
      <div className="flex flex-col-reverse justify-between gap-6 border-b border-line pb-6 @xl:flex-row @xl:items-start">
        <div>
          <Logo />
          <div className="mt-4 text-lg font-bold text-heading">{settings.companyName}</div>
          {settings.tagline && <div className="text-sm text-muted">{settings.tagline}</div>}
          {settings.address && <div className="mt-1 text-xs text-muted">{settings.address}</div>}
        </div>
        <div className="@xl:text-right">
          <div className="text-4xl font-extrabold tracking-tight text-heading">INVOICE</div>
          <div className="mt-1 font-semibold text-muted">#{invoice.invoiceNumber}</div>
          <div className="mt-3">
            <Badge status={status} dot className="px-3 py-1 text-sm" />
          </div>
        </div>
      </div>

      {/* Billed to / details */}
      <div className="grid gap-6 border-b border-line py-6 @xl:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-bold text-heading">Billed To</div>
          <div className="text-lg font-bold text-heading">{c.name}</div>
          {c.company && <div className="text-sm text-fg">{c.company}</div>}
          <div className="mt-2 space-y-1 text-sm text-muted">
            {c.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {c.email}
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> {c.phone}
              </div>
            )}
            {c.address && <div className="pl-6">{c.address}</div>}
          </div>
        </div>
        <div className="@xl:border-l @xl:border-line @xl:pl-6">
          <div className="mb-2 text-sm font-bold text-heading">Invoice Details</div>
          <dl className="space-y-1.5 text-sm">
            <DetailRow icon={<FileText className="h-4 w-4" />} label="Invoice No:" value={`#${invoice.invoiceNumber}`} />
            <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Issue Date:" value={formatDate(invoice.issueDate)} />
            <DetailRow icon={<Clock3 className="h-4 w-4" />} label="Due Date:" value={formatDate(invoice.dueDate)} />
            <DetailRow icon={<BadgeCheck className="h-4 w-4" />} label="Status:" value={<Badge status={status} />} />
          </dl>
        </div>
      </div>

      {/* Requirement */}
      {(req?.summary || reqTags.length > 0) && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 @xl:flex-row @xl:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-brand">Project Requirement</div>
            {req?.summary && <div className="text-sm text-heading">{req.summary}</div>}
          </div>
          {reqTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs text-muted @xl:max-w-[45%] @xl:justify-end">
              {reqTags.map((tag) => (
                <span key={tag} className="rounded-full bg-white px-2 py-0.5 ring-1 ring-blue-100">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Items — table on desktop */}
      <div className="mt-6 hidden overflow-hidden rounded-xl border border-line @xl:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs font-bold text-heading">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-center">Qty / Unit</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-4 py-3 text-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-heading">{it.description}</div>
                  {it.details && <div className="text-xs text-muted">{it.details}</div>}
                </td>
                <td className="px-4 py-3 text-center text-fg">
                  {formatNumber(it.qty)} {it.unit}
                </td>
                <td className="px-4 py-3 text-right text-fg">{n(it.rate)}</td>
                <td className="px-4 py-3 text-right font-semibold text-heading">{n(it.qty * it.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Items — cards on mobile */}
      <div className="mt-6 space-y-2 @xl:hidden">
        <div className="text-sm font-bold text-heading">Invoice Items</div>
        {invoice.items.map((it, i) => (
          <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 text-sm">
            <div>
              <div className="font-semibold text-heading">{it.description}</div>
              <div className="text-xs text-muted">
                {formatNumber(it.qty)} {it.unit} × {n(it.rate)}
              </div>
            </div>
            <div className="whitespace-nowrap font-bold text-heading">
              {n(it.qty * it.rate)}
            </div>
          </div>
        ))}
      </div>

      {/* Adjustments + totals */}
      <div className="mt-4 grid gap-4 @2xl:grid-cols-[1fr_320px]">
        <div className="space-y-2 text-sm">
          {invoice.extraCosts.map((e, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <PlusCircle className="h-4 w-4 text-muted" />
              <span className="font-semibold text-heading">Extra Cost</span>
              <span className="flex-1 text-muted">{e.label}</span>
              <span className="font-semibold">{n(e.amount)}</span>
            </div>
          ))}
          {t.discount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <Percent className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-emerald-600">Discount</span>
              <span className="flex-1 text-muted">
                {invoice.discountLabel || (invoice.discountType === "percent" ? `${invoice.discountValue}% off` : "")}
              </span>
              <span className="font-semibold text-emerald-600">{n(-t.discount)}</span>
            </div>
          )}
          {invoice.taxPercent > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <Receipt className="h-4 w-4 text-muted" />
              <span className="font-semibold text-heading">Tax</span>
              <span className="flex-1 text-muted">{invoice.taxPercent}%</span>
              <span className="font-semibold">{n(t.tax)}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface-2/60 p-4 text-sm">
          <TotalRow label="Subtotal" value={n(t.subtotal)} />
          {t.discount > 0 && <TotalRow label="Discount" value={n(-t.discount)} />}
          {t.tax > 0 && <TotalRow label={`Tax (${invoice.taxPercent}%)`} value={n(t.tax)} />}
          <div className="my-2 border-t border-line" />
          <TotalRow label={`Total (${cur})`} value={n(t.total)} strong />
          {t.paid > 0 && <TotalRow label={t.balance <= 0 ? "Amount Paid" : "Advance Paid"} value={n(t.paid)} />}
          <div className="mt-3 flex items-end justify-between gap-3 rounded-lg bg-white px-3 py-3 ring-1 ring-line">
            <span className="text-sm font-bold text-brand">Balance Due ({cur})</span>
            <span className="text-3xl font-extrabold leading-none text-gradient">{n(t.balance)}</span>
          </div>
        </div>
      </div>

      {/* Payment details */}
      {(hasBank || pd.other) && (
        <div className="mt-6 rounded-xl border border-line p-4">
          <div className="mb-3 flex items-center gap-2 font-bold text-brand">
            <Landmark className="h-5 w-5" /> Payment Details
          </div>
          {hasBank && (
            <dl className="grid gap-x-6 gap-y-1 text-sm @xl:grid-cols-[140px_1fr]">
              <div className="col-span-full mb-1 font-semibold text-heading">Bank Transfer (Recommended)</div>
              {pd.bankName && <PayRow label="Bank Name" value={pd.bankName} />}
              {pd.accountName && <PayRow label="Account Title" value={pd.accountName} />}
              {pd.accountNumber && <PayRow label="Account No" value={pd.accountNumber} />}
              {pd.iban && <PayRow label="IBAN" value={pd.iban} />}
            </dl>
          )}
          {pd.other && <p className="mt-3 whitespace-pre-wrap text-sm text-fg">{pd.other}</p>}
        </div>
      )}

      {/* Notes / terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="mt-6 grid gap-4 text-sm @xl:grid-cols-2">
          {invoice.notes && (
            <div>
              <div className="mb-1 font-bold text-heading">Notes</div>
              <p className="whitespace-pre-wrap text-muted">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <div className="mb-1 font-bold text-heading">Terms & Conditions</div>
              <p className="whitespace-pre-wrap text-muted">{invoice.terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 flex flex-col justify-between gap-3 rounded-xl bg-surface-2/70 p-4 text-sm @xl:flex-row @xl:items-center">
        <div>
          <div className="font-bold text-heading">Thank you for choosing {settings.companyName}!</div>
          <div className="text-xs text-muted">We appreciate your trust and look forward to a successful partnership.</div>
        </div>
        <div className="space-y-1 text-xs text-muted @xl:text-right">
          {settings.email && (
            <div className="flex items-center gap-1.5 @xl:justify-end">
              <Mail className="h-3.5 w-3.5" /> {settings.email}
            </div>
          )}
          {settings.phone && (
            <div className="flex items-center gap-1.5 @xl:justify-end">
              <Phone className="h-3.5 w-3.5" /> {settings.phone}
            </div>
          )}
          {settings.website && (
            <div className="flex items-center gap-1.5 @xl:justify-end">
              <Globe className="h-3.5 w-3.5" /> {settings.website}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted">{icon}</span>
      <dt className="w-24 text-muted">{label}</dt>
      <dd className="font-semibold text-heading">{value}</dd>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={strong ? "font-bold text-heading" : "text-muted"}>{label}</span>
      <span className={strong ? "text-base font-bold text-heading" : "font-semibold text-fg"}>{value}</span>
    </div>
  );
}

function PayRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}:</dt>
      <dd className="font-semibold text-heading">{value}</dd>
    </>
  );
}
