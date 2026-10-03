import { BadgeCheck, CalendarDays, CheckCircle2, Clock3, FileText, ListChecks, Mail, Phone } from "lucide-react";
import { Logo } from "./Logo";
import { Badge } from "./ui";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import type { ClientT, QuoteT, SettingsT } from "@/lib/types";

/** The proposal as the client sees it. Always on a light "paper" surface; also used for the PDF. */
export function QuoteDocument({ quote, settings, client, expired }: { quote: QuoteT; settings: SettingsT; client: ClientT | null; expired?: boolean }) {
  const t = quote.totals;
  const n = (v: number) => formatMoney(v, quote.currency);
  const status = expired ? "Expired" : quote.status;
  const setup = quote.projectSetup;

  return (
    <div data-invoice-doc className="paper print-plain @container mx-auto w-full max-w-[860px] rounded-2xl border border-line bg-surface p-5 text-fg shadow-xl shadow-brand/5 sm:p-10">
      <div className="flex flex-col-reverse justify-between gap-6 border-b border-line pb-6 @xl:flex-row @xl:items-start">
        <div>
          <Logo />
          <div className="mt-4 text-lg font-bold text-heading">{settings.companyName}</div>
          {settings.tagline && <div className="text-sm text-muted">{settings.tagline}</div>}
          {(settings.email || settings.phone) && (
            <div className="mt-1 text-xs text-muted">{[settings.email, settings.phone, settings.website].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        <div className="@xl:text-right">
          <div className="text-4xl font-extrabold tracking-tight text-heading">PROPOSAL</div>
          <div className="mt-1 font-semibold text-muted">#{quote.number}</div>
          <div className="mt-3">
            <Badge status={status} dot className="px-3 py-1 text-sm" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-b border-line py-6 @xl:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-bold text-heading">Prepared For</div>
          <div className="text-lg font-bold text-heading">{client?.name}</div>
          {client?.company && <div className="text-sm text-fg">{client.company}</div>}
          <div className="mt-2 space-y-1 text-sm text-muted">
            {client?.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {client.email}
              </div>
            )}
            {client?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> {client.phone}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1.5 text-sm @xl:border-l @xl:border-line @xl:pl-6">
          <div className="mb-2 text-sm font-bold text-heading">Proposal Details</div>
          <Row icon={<FileText className="h-4 w-4" />} label="Proposal No:" value={`#${quote.number}`} />
          <Row icon={<CalendarDays className="h-4 w-4" />} label="Date:" value={formatDate(quote.sentAt || quote.createdAt)} />
          <Row icon={<Clock3 className="h-4 w-4" />} label="Valid until:" value={formatDate(quote.validUntil)} />
          {setup?.durationDays ? <Row icon={<BadgeCheck className="h-4 w-4" />} label="Delivery:" value={`${setup.durationDays} days after approval`} /> : null}
        </div>
      </div>

      <div className="mt-6">
        <h1 className="text-2xl font-bold text-heading">{quote.title}</h1>
        {quote.intro && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{quote.intro}</p>}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs font-bold text-heading">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="hidden px-4 py-3 text-center @xl:table-cell">Qty</th>
              <th className="hidden px-4 py-3 text-right @xl:table-cell">Rate</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="font-semibold text-heading">{it.description}</div>
                  {it.details && <div className="text-xs text-muted">{it.details}</div>}
                  <div className="text-xs text-muted @xl:hidden">
                    {formatNumber(it.qty)} {it.unit} × {n(it.rate)}
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-center @xl:table-cell">
                  {formatNumber(it.qty)} {it.unit}
                </td>
                <td className="hidden px-4 py-3 text-right @xl:table-cell">{n(it.rate)}</td>
                <td className="px-4 py-3 text-right font-semibold text-heading">{n(it.qty * it.rate)}</td>
              </tr>
            ))}
            {quote.extraCosts.map((e, i) => (
              <tr key={`x${i}`} className="border-t border-line">
                <td className="px-4 py-3 font-semibold text-heading">{e.label}</td>
                <td className="hidden @xl:table-cell" />
                <td className="hidden @xl:table-cell" />
                <td className="px-4 py-3 text-right font-semibold text-heading">{n(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{n(t.subtotal)}</span></div>
        {t.discount > 0 && <div className="flex justify-between"><span className="text-muted">Discount</span><span>-{n(t.discount)}</span></div>}
        {t.tax > 0 && <div className="flex justify-between"><span className="text-muted">Tax ({quote.taxPercent}%)</span><span>{n(t.tax)}</span></div>}
        <div className="flex justify-between rounded-xl bg-brand-gradient px-4 py-3 text-base font-bold text-white">
          <span>Total</span>
          <span>{n(t.total)}</span>
        </div>
      </div>

      {setup?.checklist && setup.checklist.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-heading">
            <ListChecks className="h-4 w-4 text-brand" /> What we will deliver
          </div>
          <ul className="grid gap-x-6 gap-y-1 text-sm text-fg @xl:grid-cols-2">
            {setup.checklist.map((c) => (
              <li key={c} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {c}
              </li>
            ))}
          </ul>
          {setup.revisionLimit ? <p className="mt-2 text-xs text-muted">Includes {setup.revisionLimit} revision round{setup.revisionLimit === 1 ? "" : "s"}.</p> : null}
        </div>
      )}

      {(quote.notes || quote.terms) && (
        <div className="mt-8 grid gap-6 border-t border-line pt-6 @xl:grid-cols-2">
          {quote.notes && (
            <div>
              <div className="mb-1 text-sm font-bold text-heading">Notes</div>
              <p className="whitespace-pre-wrap text-sm text-muted">{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div>
              <div className="mb-1 text-sm font-bold text-heading">Terms</div>
              <p className="whitespace-pre-wrap text-sm text-muted">{quote.terms}</p>
            </div>
          )}
        </div>
      )}

      {quote.status === "Accepted" && quote.acceptedAt && (
        <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="flex items-center gap-2 font-bold text-emerald-800">
            <CheckCircle2 className="h-5 w-5" /> Accepted and signed electronically
          </div>
          <div className="mt-2 font-serif text-2xl italic text-heading">{quote.acceptedName}</div>
          <div className="mt-1 text-xs text-muted">
            {new Date(quote.acceptedAt).toUTCString()}
            {quote.acceptedIp ? ` · IP ${quote.acceptedIp}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted">{icon}</span>
      <span className="w-24 text-muted">{label}</span>
      <span className="font-semibold text-heading">{value}</span>
    </div>
  );
}
