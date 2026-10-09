import Link from "next/link";
import { CalendarClock, CalendarRange, Receipt, Wallet } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { monthlyCost } from "@/lib/expenses";
import { Expense } from "@/models/Expense";
import { Client } from "@/models/Client";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { SectionTabs } from "@/components/DealTabs";
import { DeleteButton } from "@/components/actions";
import { EditExpenseButton, NewExpenseButton, type ExpenseRow } from "@/components/ExpenseForms";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Expenses" };

const CATEGORIES = ["Domain", "Hosting", "Database", "Email", "Software", "Ads", "Salary", "Office", "Other"];

type Doc = Omit<ExpenseRow, "_id" | "client" | "date" | "renewsOn"> & { _id: unknown; client?: { _id: unknown; name: string; company?: string } | null; date: Date; renewsOn?: Date | null };

/** Adds up amounts per currency, e.g. "PKR 12,000 + $40". */
function sum(rows: { currency: string; value: number }[]) {
  const by = new Map<string, number>();
  for (const r of rows) if (r.value) by.set(r.currency, (by.get(r.currency) || 0) + r.value);
  return [...by.entries()].sort((a, b) => b[1] - a[1]);
}
const show = (parts: [string, number][], fallback: string) => (parts.length ? parts.map(([c, v]) => formatMoney(Math.round(v * 100) / 100, c)).join(" + ") : fallback);

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ cat?: string; view?: string }> }) {
  await pageUser(ADMIN);
  const sp = await searchParams;
  await dbConnect();
  const [docs, clientDocs, settings] = await Promise.all([
    Expense.find().sort({ active: -1, date: -1 }).populate("client", "name company").lean<Doc[]>(),
    Client.find().select("name company").sort({ company: 1, name: 1 }).lean<{ _id: unknown; name: string; company?: string }[]>(),
    getSettings(),
  ]);
  const cur = settings.defaultCurrency || "PKR";
  const clients = clientDocs.map((c) => ({ _id: String(c._id), name: c.name, company: c.company }));

  // Running costs count only subscriptions still being paid.
  const live = docs.filter((d) => d.active && d.cycle !== "One-time");
  const monthly = sum(live.map((d) => ({ currency: d.currency, value: monthlyCost(d) })));
  const yearly = sum(live.map((d) => ({ currency: d.currency, value: monthlyCost(d) * 12 })));
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const oneTime = sum(docs.filter((d) => d.cycle === "One-time" && new Date(d.date) >= yearStart).map((d) => ({ currency: d.currency, value: d.amount })));
  const soon = live.filter((d) => d.renewsOn && new Date(d.renewsOn).getTime() - Date.now() < 30 * 86_400_000).sort((a, b) => +new Date(a.renewsOn!) - +new Date(b.renewsOn!));

  const stopped = sp.view === "stopped";
  const list = docs.filter((d) => (stopped ? !d.active : d.active) && (!sp.cat || d.category === sp.cat));
  const totalAmount = sum(list.map((d) => ({ currency: d.currency, value: d.amount })));
  const totalMonthly = sum(list.map((d) => ({ currency: d.currency, value: monthlyCost(d) })));
  const counts = new Map<string, number>();
  for (const d of docs.filter((x) => (stopped ? !x.active : x.active))) counts.set(d.category, (counts.get(d.category) || 0) + 1);

  const href = (p: { cat?: string; view?: string }) => {
    const q = new URLSearchParams();
    if (p.cat) q.set("cat", p.cat);
    if (p.view) q.set("view", p.view);
    const s = q.toString();
    return `/expenses${s ? `?${s}` : ""}`;
  };
  const row = (d: Doc): ExpenseRow => ({
    _id: String(d._id),
    title: d.title,
    category: d.category,
    vendor: d.vendor,
    amount: d.amount,
    currency: d.currency,
    cycle: d.cycle,
    date: new Date(d.date).toISOString(),
    renewsOn: d.renewsOn ? new Date(d.renewsOn).toISOString() : null,
    client: d.client ? String(d.client._id) : null,
    notes: d.notes,
    active: d.active,
  });

  return (
    <div>
      <SectionTabs group="billing" current="/expenses" />
      <PageHeader title="Expenses" subtitle="Everything the business pays for: domains, hosting, database, email, tools and more.">
        <NewExpenseButton currency={cur} clients={clients} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Monthly running cost" value={show(monthly, formatMoney(0, cur))} hint="Monthly + yearly ÷ 12" tone="violet" />
        <StatCard icon={CalendarRange} label="Yearly running cost" value={show(yearly, formatMoney(0, cur))} hint="All active subscriptions" tone="blue" />
        <StatCard icon={Receipt} label="One-time this year" value={show(oneTime, formatMoney(0, cur))} tone="slate" />
        <StatCard icon={CalendarClock} label="Renewing in 30 days" value={soon.length} hint={soon[0] ? `Next: ${soon[0].title}` : "Nothing due"} tone={soon.length ? "amber" : "slate"} />
      </div>

      {soon.length > 0 && !stopped && (
        <div className="card mb-5 p-4">
          <h2 className="mb-2 text-sm font-bold text-heading">Coming up for renewal</h2>
          <ul className="divide-y divide-line text-sm">
            {soon.map((d) => {
              const days = Math.ceil((new Date(d.renewsOn!).getTime() - Date.now()) / 86_400_000);
              return (
                <li key={String(d._id)} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <b className="text-heading">{d.title}</b> <span className="text-muted">{d.vendor && `· ${d.vendor}`}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-semibold">{formatMoney(d.amount, d.currency)}</span>
                    <span className={cn("ml-2 text-xs", days <= 7 ? "font-semibold text-red-500" : "text-muted")}>{days <= 0 ? "due now" : `in ${days} day${days === 1 ? "" : "s"}`}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Link href={href({ view: sp.view })} className={cn("rounded-full px-3 py-1 text-xs font-semibold", !sp.cat ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted hover:text-fg")}>
          All
        </Link>
        {CATEGORIES.filter((c) => counts.get(c)).map((c) => (
          <Link key={c} href={href({ cat: c, view: sp.view })} className={cn("rounded-full px-3 py-1 text-xs font-semibold", sp.cat === c ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted hover:text-fg")}>
            {c} ({counts.get(c)})
          </Link>
        ))}
        <Link href={href({ cat: sp.cat, view: stopped ? undefined : "stopped" })} className="ml-auto text-xs font-semibold text-muted hover:text-fg">
          {stopped ? "← Back to active" : "Show cancelled"}
        </Link>
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon={Wallet} title={stopped ? "No cancelled expenses" : "No expenses yet"} text={stopped ? undefined : "Add your domain, hosting, database and email costs to see what the business spends each month."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Expense</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Per month</th>
                  <th className="px-4 py-3">Next renewal</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((d) => (
                  <tr key={String(d._id)} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-heading">{d.title}</div>
                      <div className="text-xs text-muted">
                        {[d.vendor, d.client && `for ${d.client.company || d.client.name}`].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold">{d.category}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{d.cycle}</td>
                    <td className="px-4 py-3 text-right font-semibold text-heading">{formatMoney(d.amount, d.currency)}</td>
                    <td className="px-4 py-3 text-right text-muted">{d.cycle === "One-time" ? "—" : formatMoney(Math.round(monthlyCost(d) * 100) / 100, d.currency)}</td>
                    <td className="px-4 py-3 text-muted">{d.cycle === "One-time" ? formatDate(d.date) : d.renewsOn ? formatDate(d.renewsOn) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <EditExpenseButton expense={row(d)} clients={clients} />
                        <DeleteButton url={`/api/expenses/${String(d._id)}`} confirmText={`Delete "${d.title}"?`} small />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-surface-2/60 font-bold text-heading">
                  <td className="px-4 py-3" colSpan={3}>
                    Total ({list.length} item{list.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-4 py-3 text-right">{show(totalAmount, formatMoney(0, cur))}</td>
                  <td className="px-4 py-3 text-right">{show(totalMonthly, "—")}</td>
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
