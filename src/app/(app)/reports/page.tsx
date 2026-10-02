import Link from "next/link";
import { AlertTriangle, BarChart3, Briefcase, Crown, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Invoice } from "@/models/Invoice";
import { Query } from "@/models/Query";
import { Badge, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { formatDate, formatMoney, isOverdue, serialize } from "@/lib/utils";
import type { InvoiceT } from "@/lib/types";

export const metadata = { title: "Reports" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ACTIVE = { status: { $nin: ["Draft", "Cancelled"] } };

type Group = { _id: { y: number; m: number }; total: number };

export default async function ReportsPage() {
  await dbConnect();
  const settings = await getSettings();
  const cur = settings.defaultCurrency;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [summary, invoicedByMonth, collectedByMonth, byService, topClients, workload, outstanding] = await Promise.all([
    Invoice.aggregate([
      { $match: ACTIVE },
      { $group: { _id: null, total: { $sum: "$totals.total" }, paid: { $sum: "$totals.paid" }, balance: { $sum: "$totals.balance" }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { ...ACTIVE, issueDate: { $gte: start } } },
      { $group: { _id: { y: { $year: "$issueDate" }, m: { $month: "$issueDate" } }, total: { $sum: "$totals.total" } } },
    ]),
    Invoice.aggregate([
      { $match: ACTIVE },
      { $unwind: "$payments" },
      { $match: { "payments.date": { $gte: start } } },
      { $group: { _id: { y: { $year: "$payments.date" }, m: { $month: "$payments.date" } }, total: { $sum: "$payments.amount" } } },
    ]),
    Query.aggregate([
      { $group: { _id: { $ifNull: ["$service", "Other"] }, count: { $sum: 1 }, value: { $sum: "$amount" }, done: { $sum: { $cond: [{ $in: ["$status", ["Completed", "Closed"]] }, 1, 0] } } } },
      { $sort: { count: -1 } },
    ]),
    Invoice.aggregate([
      { $match: ACTIVE },
      { $group: { _id: "$client", name: { $first: "$clientSnapshot.name" }, company: { $first: "$clientSnapshot.company" }, total: { $sum: "$totals.total" }, balance: { $sum: "$totals.balance" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    Query.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$assignedTo", ""] },
          pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
          progress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $in: ["$status", ["Completed", "Closed"]] }, 1, 0] } },
          overdue: {
            $sum: { $cond: [{ $and: [{ $in: ["$status", ["Pending", "In Progress"]] }, { $lt: ["$dueDate", now] }, { $ne: ["$dueDate", null] }] }, 1, 0] },
          },
        },
      },
      { $sort: { pending: -1 } },
    ]),
    Invoice.find({ ...ACTIVE, "totals.balance": { $gt: 0 } }).sort({ dueDate: 1 }).limit(20).lean(),
  ]);

  const s = summary[0] || { total: 0, paid: 0, balance: 0, count: 0 };
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const match = (g: Group) => g._id.y === d.getFullYear() && g._id.m === d.getMonth() + 1;
    return {
      label: MONTHS[d.getMonth()]!,
      sub: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      invoiced: (invoicedByMonth as Group[]).find(match)?.total || 0,
      collected: (collectedByMonth as Group[]).find(match)?.total || 0,
    };
  });
  const due = serialize<InvoiceT[]>(outstanding);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Revenue, collections, outstanding payments and team workload in one place." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Receipt} tone="blue" label="Total invoiced" value={formatMoney(s.total, cur)} hint={`${s.count} active invoice(s)`} />
        <StatCard icon={Wallet} tone="green" label="Collected" value={formatMoney(s.paid, cur)} hint={s.total ? `${Math.round((s.paid / s.total) * 100)}% collection rate` : "—"} />
        <StatCard icon={AlertTriangle} tone="red" label="Outstanding" value={formatMoney(s.balance, cur)} valueClass={s.balance ? "text-red-500" : ""} hint={`${due.length} invoice(s) with balance`} />
        <StatCard icon={TrendingUp} tone="violet" label="Avg. invoice value" value={formatMoney(s.count ? s.total / s.count : 0, cur)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card">
          <CardHeader icon={BarChart3} title="Invoiced per month" subtitle="Last 12 months" />
          <div className="px-4 pb-4">
            <BarChart data={months.map((m) => ({ label: m.label, sub: m.sub, value: m.invoiced }))} currency={cur} height={240} />
          </div>
        </div>
        <div className="card">
          <CardHeader icon={Wallet} title="Collected per month" subtitle="Payments received, last 12 months" />
          <div className="px-4 pb-4">
            <BarChart data={months.map((m) => ({ label: m.label, sub: m.sub, value: m.collected }))} currency={cur} height={240} />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <CardHeader icon={AlertTriangle} title="Outstanding invoices" subtitle="Follow up on these first. Sorted by due date." />
        {due.length === 0 ? (
          <EmptyState icon={Wallet} title="Nothing outstanding" text="All active invoices are fully paid." />
        ) : (
          <div className="overflow-x-auto px-3 pb-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Client activity</th>
                </tr>
              </thead>
              <tbody>
                {due.map((i) => {
                  const late = isOverdue(i.dueDate);
                  return (
                    <tr key={i._id}>
                      <td>
                        <Link href={`/invoices/${i._id}`} className="font-bold text-heading hover:text-brand">
                          {i.invoiceNumber}
                        </Link>
                      </td>
                      <td>{i.clientSnapshot?.name}</td>
                      <td className={late ? "font-semibold text-red-500" : "text-muted"}>{formatDate(i.dueDate)}</td>
                      <td>{formatMoney(i.totals.total, i.currency)}</td>
                      <td className="font-semibold text-red-500">{formatMoney(i.totals.balance, i.currency)}</td>
                      <td>
                        <Badge status={late ? "Overdue" : i.status} />
                      </td>
                      <td className="text-xs text-muted">{i.confirmedAt ? "Confirmed" : i.viewCount ? `Viewed ${i.viewCount}x` : "Not viewed"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <CardHeader icon={Users} title="Team workload" subtitle="Open work and overdue items per team member." />
          {workload.length === 0 ? (
            <EmptyState icon={Users} title="No queries yet" />
          ) : (
            <div className="overflow-x-auto px-3 pb-3">
              <table className="table">
                <thead>
                  <tr>
                    <th>Team member</th>
                    <th>Pending</th>
                    <th>In progress</th>
                    <th>Done</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {(workload as { _id: string; pending: number; progress: number; completed: number; overdue: number }[]).map((w) => (
                    <tr key={w._id || "none"}>
                      <td className="font-semibold">
                        {w._id ? (
                          <Link href={`/queries?assigned=${encodeURIComponent(w._id)}`} className="hover:text-brand">
                            {w._id}
                          </Link>
                        ) : (
                          <span className="text-red-500">Unassigned</span>
                        )}
                      </td>
                      <td>{w.pending}</td>
                      <td>{w.progress}</td>
                      <td>{w.completed}</td>
                      <td className={w.overdue ? "font-bold text-red-500" : "text-muted"}>{w.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <CardHeader icon={Crown} title="Top clients" subtitle="By total invoiced" />
          {topClients.length === 0 ? (
            <EmptyState icon={Crown} title="No invoices yet" />
          ) : (
            <div className="overflow-x-auto px-3 pb-3">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Invoices</th>
                    <th>Total</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(topClients as { _id: unknown; name: string; company?: string; total: number; balance: number; count: number }[]).map((c) => (
                    <tr key={String(c._id)}>
                      <td>
                        <Link href={`/clients/${String(c._id)}`} className="font-semibold hover:text-brand">
                          {c.name}
                        </Link>
                        <div className="text-xs text-muted">{c.company}</div>
                      </td>
                      <td>{c.count}</td>
                      <td className="font-semibold">{formatMoney(c.total, cur)}</td>
                      <td className={c.balance ? "font-semibold text-red-500" : "text-muted"}>{formatMoney(c.balance, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <CardHeader icon={Briefcase} title="Queries by service" subtitle="Which services clients ask for most." />
        {byService.length === 0 ? (
          <EmptyState icon={Briefcase} title="No queries yet" />
        ) : (
          <div className="overflow-x-auto px-3 pb-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Queries</th>
                  <th>Completed / Closed</th>
                  <th>Estimated value</th>
                </tr>
              </thead>
              <tbody>
                {(byService as { _id: string; count: number; value: number; done: number }[]).map((r) => (
                  <tr key={r._id}>
                    <td className="font-semibold">{r._id}</td>
                    <td>{r.count}</td>
                    <td>{r.done}</td>
                    <td>{formatMoney(r.value, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
