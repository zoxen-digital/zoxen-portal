import { CalendarDays, CheckCircle2, FileText, LifeBuoy, RefreshCcw, Rocket, Wallet } from "lucide-react";
import { Logo } from "./Logo";
import { Badge } from "./ui";
import { formatDate, formatMoney } from "@/lib/utils";
import { STAGE_INFO, type ProjectStage } from "@/lib/constants";
import type { ReportData } from "@/lib/report";
import type { SettingsT } from "@/lib/types";

const money = (totals: Record<string, number>) => {
  const parts = Object.entries(totals).map(([c, v]) => formatMoney(v, c));
  return parts.length ? parts.join(" + ") : formatMoney(0);
};

/** Month summary for a client. Rendered on paper so it prints / exports to PDF cleanly. */
export function ReportDocument({ r, settings }: { r: ReportData; settings: SettingsT }) {
  const tasks = r.projects.reduce((s, p) => s + p.tasksDone.length, 0);
  const revs = r.projects.reduce((s, p) => s + p.revisionsDone, 0);

  return (
    <div data-invoice-doc className="paper print-plain mx-auto w-full max-w-[860px] rounded-2xl border border-line bg-surface p-5 text-fg shadow-xl shadow-brand/5 sm:p-10">
      <div className="flex flex-col-reverse justify-between gap-6 border-b border-line pb-6 sm:flex-row sm:items-start">
        <div>
          <Logo />
          <div className="mt-4 text-lg font-bold text-heading">{settings.companyName}</div>
        </div>
        <div className="sm:text-right">
          <div className="text-3xl font-extrabold tracking-tight text-heading">MONTHLY REPORT</div>
          <div className="mt-1 font-semibold text-brand">{r.label}</div>
          <div className="mt-1 text-sm text-muted">{r.client.company || r.client.name}</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: CheckCircle2, label: "Tasks completed", value: tasks },
          { icon: RefreshCcw, label: "Revisions done", value: revs },
          { icon: CalendarDays, label: "Meetings", value: r.meetings.length },
          { icon: LifeBuoy, label: "Requests resolved", value: r.tickets.resolved },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-2 p-4">
            <s.icon className="h-5 w-5 text-brand" />
            <div className="mt-2 text-2xl font-bold text-heading">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-lg font-bold text-heading">
        <Rocket className="h-5 w-5 text-brand" /> Projects
      </h2>
      {r.projects.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No project activity this month.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {r.projects.map((p) => (
            <div key={p.title} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-heading">{p.title}</div>
                <div className="flex items-center gap-2">
                  <Badge status={STAGE_INFO[p.stage as ProjectStage]?.client || p.stage} />
                  <span className="text-sm font-semibold">{p.progress}%</span>
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${p.progress}%` }} />
              </div>
              {p.updates.length > 0 && <p className="mt-2 text-xs text-muted">Status this month: {p.updates.join(" → ")}</p>}
              {p.tasksDone.length > 0 && (
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {p.tasksDone.map((t) => (
                    <li key={t} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {t}
                    </li>
                  ))}
                </ul>
              )}
              {(p.revisionsRequested > 0 || p.revisionsDone > 0) && (
                <p className="mt-2 text-xs text-muted">
                  Revisions: {p.revisionsRequested} requested, {p.revisionsDone} completed
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-heading">
            <FileText className="h-5 w-5 text-brand" /> Invoices
          </h2>
          {r.invoices.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No new invoices.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line text-sm">
              {r.invoices.map((i) => (
                <li key={i.number} className="flex justify-between py-2">
                  <span>
                    {i.number} <span className="text-xs text-muted">· {formatDate(i.date)}</span>
                  </span>
                  <span className="font-semibold">{formatMoney(i.total, i.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">
            Invoiced this month: <b className="text-heading">{money(r.totals.invoiced)}</b>
          </p>
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-heading">
            <Wallet className="h-5 w-5 text-brand" /> Payments received
          </h2>
          {r.payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No payments this month.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line text-sm">
              {r.payments.map((p, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span>
                    {p.invoice} <span className="text-xs text-muted">· {formatDate(p.date)}</span>
                  </span>
                  <span className="font-semibold text-emerald-600">{formatMoney(p.amount, p.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">
            Received this month: <b className="text-heading">{money(r.totals.paid)}</b>
          </p>
        </div>
      </div>

      {(r.meetings.length > 0 || r.tickets.list.length > 0) && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {r.meetings.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-heading">Meetings</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {r.meetings.map((m, i) => (
                  <li key={i}>
                    {formatDate(m.date)} · {m.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.tickets.list.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-heading">Support requests</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {r.tickets.list.map((t) => (
                  <li key={t.number} className="flex justify-between gap-2">
                    <span className="truncate">
                      {t.number} · {t.title}
                    </span>
                    <span className="text-xs text-muted">{t.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="mt-10 border-t border-line pt-4 text-center text-xs text-muted">
        Thank you for working with {settings.companyName}. Questions about this report? Reply in your client portal.
      </p>
    </div>
  );
}
