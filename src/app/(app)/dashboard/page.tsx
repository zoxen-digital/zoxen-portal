import Link from "next/link";
import { ArrowUpRight, CalendarDays, FileText, Plus, ShieldCheck, UserPlus } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ADMIN, pageUser } from "@/lib/session";
import { OPEN_STAGES } from "@/lib/constants";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";
import { Avatar } from "@/components/ui";
import { AreaChart, Gauge, MiniBars, Sparkline } from "@/components/dash";
import { cn, formatMoney } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ACTIVE_INVOICE = { status: { $nin: ["Draft", "Cancelled"] } };

type Agg = { _id: { y: number; m: number; d?: number }; total: number };

function greeting(h: number) {
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Percent change vs the previous value, as "+5.4%" (null when there is nothing to compare). */
function change(now: number, before: number) {
  if (!before) return null;
  const p = ((now - before) / before) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

export default async function DashboardPage() {
  const user = await pageUser(ADMIN);
  await dbConnect();
  const settings = await getSettings();
  const cur = settings.defaultCurrency;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totals, monthly, payDaily, payMonth, payLastMonth, payToday, recentPayments, clientMonthly, recentClients, totalClients, openProjects, openQueries, unpaidList] =
    await Promise.all([
      Invoice.aggregate([{ $match: ACTIVE_INVOICE }, { $group: { _id: null, total: { $sum: "$totals.total" }, balance: { $sum: "$totals.balance" }, unpaid: { $sum: { $cond: [{ $gt: ["$totals.balance", 0] }, 1, 0] } } } }]),
      Invoice.aggregate([{ $match: { ...ACTIVE_INVOICE, issueDate: { $gte: yearStart } } }, { $group: { _id: { y: { $year: "$issueDate" }, m: { $month: "$issueDate" } }, total: { $sum: "$totals.total" } } }]),
      Invoice.aggregate([{ $unwind: "$payments" }, { $match: { "payments.date": { $gte: new Date(today.getTime() - 13 * 86_400_000) } } }, { $group: { _id: { y: { $year: "$payments.date" }, m: { $month: "$payments.date" }, d: { $dayOfMonth: "$payments.date" } }, total: { $sum: "$payments.amount" } } }]),
      Invoice.aggregate([{ $unwind: "$payments" }, { $match: { "payments.date": { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$payments.amount" }, n: { $sum: 1 } } }]),
      Invoice.aggregate([{ $unwind: "$payments" }, { $match: { "payments.date": { $gte: lastMonthStart, $lt: monthStart } } }, { $group: { _id: null, total: { $sum: "$payments.amount" } } }]),
      Invoice.aggregate([{ $unwind: "$payments" }, { $match: { "payments.date": { $gte: today } } }, { $group: { _id: null, total: { $sum: "$payments.amount" } } }]),
      Invoice.aggregate([
        { $unwind: "$payments" },
        { $sort: { "payments.date": -1 } },
        { $limit: 5 },
        { $project: { number: "$invoiceNumber", client: "$clientSnapshot.name", company: "$clientSnapshot.company", currency: 1, amount: "$payments.amount", date: "$payments.date", publicId: 1 } },
      ]),
      Client.aggregate([{ $match: { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } }, { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, total: { $sum: 1 } } }]),
      Client.find().sort({ createdAt: -1 }).limit(5).select("name company email status createdAt").lean<{ _id: unknown; name: string; company?: string; email?: string; status?: string; createdAt: Date }[]>(),
      Client.countDocuments(),
      Project.countDocuments({ stage: { $in: OPEN_STAGES } }),
      Query.countDocuments({ status: { $in: ["Pending", "In Progress"] } }),
      Invoice.find({ ...ACTIVE_INVOICE, "totals.balance": { $gt: 0 } }).sort({ dueDate: 1 }).limit(1).select("dueDate").lean<{ dueDate?: Date }[]>(),
    ]);

  const inv = totals[0] || { total: 0, balance: 0, unpaid: 0 };
  const revenue = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(yearStart.getFullYear(), yearStart.getMonth() + i, 1);
    const hit = (monthly as Agg[]).find((m) => m._id.y === d.getFullYear() && m._id.m === d.getMonth() + 1);
    return { label: MONTHS[d.getMonth()]!, sub: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, value: hit?.total || 0 };
  });
  const thisMonth = revenue[11]!.value;
  const lastMonth = revenue[10]!.value;
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() - (13 - i) * 86_400_000);
    return (payDaily as Agg[]).find((x) => x._id.y === d.getFullYear() && x._id.m === d.getMonth() + 1 && x._id.d === d.getDate())?.total || 0;
  });
  const clientsByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return (clientMonthly as Agg[]).find((x) => x._id.y === d.getFullYear() && x._id.m === d.getMonth() + 1)?.total || 0;
  });
  const collected = payMonth[0]?.total || 0;
  const collectedLast = payLastMonth[0]?.total || 0;
  const collectRate = thisMonth ? (collected / thisMonth) * 100 : 0;
  const allTimePaid = inv.total - inv.balance;
  const paidRate = inv.total ? (allTimePaid / inv.total) * 100 : 0;
  const nextDue = unpaidList[0]?.dueDate;

  const pill = (v: string | null, good = true) =>
    v && (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
          v.startsWith("-") === good ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        )}
      >
        {v}
      </span>
    );

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[28px] font-bold text-heading sm:text-[36px]">
            {greeting(now.getHours())}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">Stay on top of clients, money in and work in progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-fg shadow-[var(--card-shadow)]">
            <CalendarDays className="h-4 w-4 text-muted" />
            {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <Link href="/invoices/new" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Invoice
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Link href="/invoices" className="card flex flex-col justify-between gap-3 p-5 transition hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-muted">Invoiced this month</div>
            {pill(change(thisMonth, lastMonth))}
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="font-display truncate text-[24px] font-bold leading-none text-heading sm:text-[28px]">{formatMoney(thisMonth, cur)}</div>
            <MiniBars values={revenue.slice(-7).map((r) => r.value)} className="hidden sm:flex" />
          </div>
        </Link>

        <Link href="/clients" className="card flex flex-col justify-between gap-3 p-5 transition hover:-translate-y-0.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-heading">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="text-sm font-medium text-muted">New clients</div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="font-display text-[24px] font-bold leading-none text-heading sm:text-[28px]">{clientsByMonth[5]}</div>
              <div className="mt-1 text-xs text-muted">{totalClients} total</div>
            </div>
            <Sparkline values={clientsByMonth} className="hidden text-muted sm:block" />
          </div>
        </Link>

        <Link href="/invoices?status=Outstanding" className="card flex flex-col justify-between gap-3 p-5 transition hover:-translate-y-0.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
              <FileText className="h-4 w-4" />
            </span>
            <div className="text-sm font-medium text-muted">Waiting to be paid</div>
          </div>
          <div>
            <div className={cn("font-display truncate text-[24px] font-bold leading-none sm:text-[28px]", inv.balance > 0 ? "text-heading" : "text-emerald-600")}>{formatMoney(inv.balance, cur)}</div>
            <div className="mt-1 text-xs text-muted">
              {inv.unpaid} invoice{inv.unpaid === 1 ? "" : "s"}
              {nextDue ? ` · next due ${new Date(nextDue).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            </div>
          </div>
        </Link>

        <div className="relative flex flex-col justify-between gap-3 overflow-hidden rounded-3xl bg-navy p-5 text-white shadow-[var(--card-shadow)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/40 blur-3xl" />
          <div className="relative flex items-center gap-2 text-sm text-white/70">
            Collected
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
            </span>
          </div>
          <div className="relative flex items-end justify-between gap-2">
            <div>
              <div className="font-display truncate text-[24px] font-bold leading-none sm:text-[28px]">{formatMoney(collected, cur)}</div>
              <div className="mt-1 text-xs text-white/60">
                This month · {formatMoney(payToday[0]?.total || 0, cur)} today
              </div>
            </div>
            <Sparkline values={daily} stroke="#a5b4fc" className="hidden sm:block" />
          </div>
        </div>
      </div>

      {/* Charts + profile */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="card p-5 lg:col-span-6 xl:col-span-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-heading">Revenue</h2>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <ShieldCheck className="h-3.5 w-3.5" /> {paidRate >= 80 ? "On track" : "Needs follow-up"}
              </span>
            </div>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">Last 12 months</span>
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="rounded-2xl bg-surface px-4 py-2.5 shadow-[var(--card-shadow)] ring-1 ring-line">
              <div className="text-[11px] text-muted">Paid of all invoiced</div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-heading">{paidRate.toFixed(1)}%</span>
              </div>
            </div>
            <div className="rounded-2xl bg-surface px-4 py-2.5 shadow-[var(--card-shadow)] ring-1 ring-line">
              <div className="text-[11px] text-muted">Total invoiced</div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-heading">{formatMoney(inv.total, cur)}</span>
                {pill(change(thisMonth, lastMonth))}
              </div>
            </div>
          </div>
          <AreaChart data={revenue} currency={cur} />
        </div>

        <div className="card flex flex-col p-5 sm:col-span-1 lg:col-span-3">
          <h2 className="text-lg font-bold text-heading">Collections</h2>
          <div className="mt-1 text-xs text-muted">Money in this month</div>
          <div className="font-display mt-2 text-[28px] font-bold text-heading">{formatMoney(collected, cur)}</div>
          <div className="text-xs text-muted">
            {change(collected, collectedLast) ? (
              <>
                {change(collected, collectedLast)} vs last month
              </>
            ) : (
              `${payMonth[0]?.n || 0} payment${payMonth[0]?.n === 1 ? "" : "s"} received`
            )}
          </div>
          <div className="mt-auto pt-6">
            <Gauge percent={collectRate} label={`of ${formatMoney(thisMonth, cur)} invoiced`} />
          </div>
        </div>

        <div className="card flex flex-col items-center p-5 text-center lg:col-span-3">
          <Avatar name={user.name} className="mt-2 h-20 w-20 text-xl ring-4 ring-surface-2" />
          <div className="font-display mt-3 text-lg font-bold text-heading">{user.name}</div>
          <div className="text-xs text-muted">{user.email}</div>
          <div className="mt-5 grid w-full grid-cols-3 divide-x divide-line rounded-2xl bg-surface-2 py-3">
            <Link href="/clients" className="px-1">
              <div className="text-[11px] text-muted">Clients</div>
              <div className="font-display text-lg font-bold text-heading">{totalClients}</div>
            </Link>
            <Link href="/projects" className="px-1">
              <div className="text-[11px] text-muted">Projects</div>
              <div className="font-display text-lg font-bold text-heading">{openProjects}</div>
            </Link>
            <Link href="/queries" className="px-1">
              <div className="text-[11px] text-muted">Queries</div>
              <div className="font-display text-lg font-bold text-heading">{openQueries}</div>
            </Link>
          </div>
          <Link href="/today" className="btn btn-outline mt-4 w-full">
            Open My Day
          </Link>
        </div>
      </div>

      {/* Lists */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="card p-5 lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-heading">Recent payments</h2>
            <Link href="/invoices" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-heading" aria-label="All invoices">
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No payments yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentPayments.map((p: { _id: unknown; number: string; client?: string; company?: string; currency: string; amount: number; date: Date; publicId?: string }, i: number) => (
                <li key={i} className="flex items-center gap-3 border-l-[3px] border-heading/80 pl-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-heading">From {p.company || p.client || "client"}</div>
                    <div className="text-xs text-muted">
                      {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {p.number}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    +{formatMoney(p.amount, p.currency || cur)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-heading">New clients</h2>
              <div className="text-xs text-muted">
                {totalClients} total · {clientsByMonth[5]} this month
              </div>
            </div>
            <Link href="/clients" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-heading" aria-label="All clients">
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          {recentClients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No clients yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentClients.map((c) => (
                <li key={String(c._id)}>
                  <Link href={`/clients/${String(c._id)}`} className="flex items-center gap-3 py-2.5">
                    <Avatar name={c.company || c.name} className="h-9 w-9 text-[11px]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-heading">{c.company || c.name}</div>
                      <div className="truncate text-xs text-muted">{c.email || c.name}</div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        c.status === "Inactive" ? "bg-red-50 text-red-600 dark:bg-red-500/10" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      )}
                    >
                      {c.status || "Active"}
                    </span>
                    <span className="hidden w-14 text-right text-xs text-muted sm:block">
                      {Math.max(0, Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / 86_400_000))}d ago
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card flex flex-col items-center justify-center p-6 text-center lg:col-span-3">
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-full", inv.unpaid ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10")}>
            <FileText className="h-6 w-6" />
          </div>
          <div className="font-display mt-4 text-lg font-bold text-heading">{inv.unpaid ? "Follow up on payments" : "All paid up"}</div>
          <p className="mt-1 text-sm text-muted">
            {inv.unpaid ? `${inv.unpaid} invoice${inv.unpaid === 1 ? "" : "s"} still open, ${formatMoney(inv.balance, cur)} in total.` : "Every invoice is paid. Nice work."}
          </p>
          <Link href={inv.unpaid ? "/invoices?status=Outstanding" : "/invoices/new"} className="btn btn-primary mt-4">
            {inv.unpaid ? "Send reminders" : "New invoice"}
          </Link>
        </div>
      </div>
    </div>
  );
}
