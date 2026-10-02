import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Hourglass,
  MessageSquareText,
  PieChart,
  Receipt,
  Users,
} from "lucide-react";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Invoice } from "@/models/Invoice";
import { Avatar, Badge, CardHeader, EmptyState, StatCard } from "@/components/ui";
import { BarChart, Donut } from "@/components/charts";
import { formatDate, formatMoney, isOverdue, serialize } from "@/lib/utils";
import type { ClientT, InvoiceT, QueryT } from "@/lib/types";

export const metadata = { title: "Dashboard" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ACTIVE_INVOICE = { status: { $nin: ["Draft", "Cancelled"] } };

export default async function DashboardPage() {
  await dbConnect();
  const settings = await getSettings();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalClients, newClients, statusAgg, overdue, invAgg, monthInvoiced, monthly, recentQueries, recentInvoices] =
    await Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ createdAt: { $gte: monthStart } }),
      Query.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Query.countDocuments({ dueDate: { $lt: today }, status: { $in: ["Pending", "In Progress"] } }),
      Invoice.aggregate([
        { $match: ACTIVE_INVOICE },
        {
          $group: {
            _id: null,
            total: { $sum: "$totals.total" },
            balance: { $sum: "$totals.balance" },
            unpaidCount: { $sum: { $cond: [{ $gt: ["$totals.balance", 0] }, 1, 0] } },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: { ...ACTIVE_INVOICE, issueDate: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$totals.total" } } },
      ]),
      Invoice.aggregate([
        { $match: { ...ACTIVE_INVOICE, issueDate: { $gte: yearStart } } },
        { $group: { _id: { y: { $year: "$issueDate" }, m: { $month: "$issueDate" } }, total: { $sum: "$totals.total" } } },
      ]),
      Query.find().sort({ createdAt: -1 }).limit(6).populate("client", "name company website").lean(),
      Invoice.find().sort({ createdAt: -1 }).limit(6).lean(),
    ]);

  const counts: Record<string, number> = Object.fromEntries(
    statusAgg.map((s: { _id: string; n: number }) => [s._id, s.n])
  );
  const inv = invAgg[0] || { total: 0, balance: 0, unpaidCount: 0 };
  const cur = settings.defaultCurrency;

  const revenue = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(yearStart.getFullYear(), yearStart.getMonth() + i, 1);
    const hit = monthly.find(
      (m: { _id: { y: number; m: number } }) => m._id.y === d.getFullYear() && m._id.m === d.getMonth() + 1
    );
    return { label: MONTHS[d.getMonth()]!, sub: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, value: hit?.total || 0 };
  });

  const queries = serialize<QueryT[]>(recentQueries);
  const invoices = serialize<InvoiceT[]>(recentInvoices);
  const firstName = (process.env.ADMIN_NAME || "Admin").split(" ")[0];
  const viewAll = (href: string) => (
    <Link href={href} className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-brand dark:text-[#8f9bff]">
      View all <ArrowRight className="h-4 w-4" />
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[30px]">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening with your agency today.</p>
        </div>
        <div className="text-sm sm:text-right">
          <div className="font-medium text-fg">
            {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
          </div>
          <div className="text-xs text-muted">A productive day builds a bigger tomorrow.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard href="/clients" icon={Users} tone="blue" label="Total Clients" value={totalClients} hint={`+${newClients} new this month`} />
        <StatCard
          href="/queries?status=Pending"
          icon={MessageSquareText}
          tone="amber"
          label="Pending Queries"
          value={counts["Pending"] || 0}
          hint={overdue ? `${overdue} overdue, needs attention` : "No overdue queries"}
        />
        <StatCard href="/queries?status=In%20Progress" icon={Activity} tone="violet" label="In Progress" value={counts["In Progress"] || 0} hint="Active projects in delivery" />
        <StatCard href="/queries?status=Completed" icon={CheckCircle2} tone="green" label="Completed" value={counts["Completed"] || 0} hint={`${counts["Closed"] || 0} closed`} />
        <StatCard
          href="/invoices"
          icon={Receipt}
          tone="blue"
          label="Total Invoiced"
          value={formatMoney(inv.total, cur)}
          hint={`${formatMoney(monthInvoiced[0]?.total || 0, cur)} this month`}
        />
        <StatCard
          href="/invoices?status=Outstanding"
          icon={AlertCircle}
          tone="red"
          label="Unpaid Amount"
          value={formatMoney(inv.balance, cur)}
          valueClass={inv.balance > 0 ? "text-red-500 dark:text-red-400" : ""}
          hint={`${inv.unpaidCount} invoice(s) with balance`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <CardHeader icon={BarChart3} title="Monthly Revenue" subtitle="Total invoiced amount over the last 12 months." />
          <div className="px-4 pb-4">
            <BarChart data={revenue} currency={cur} />
          </div>
        </div>
        <div className="card">
          <CardHeader icon={PieChart} title="Query Status Breakdown" subtitle="Distribution of all client queries and projects." />
          <div className="px-5 pb-6 pt-2">
            <Donut
              centerLabel="Total Queries"
              segments={[
                { label: "Pending", value: counts["Pending"] || 0, color: "#F5A524" },
                { label: "In Progress", value: counts["In Progress"] || 0, color: "#2639E8" },
                { label: "Completed", value: counts["Completed"] || 0, color: "#17B26A" },
                { label: "Closed", value: counts["Closed"] || 0, color: "#8A8FA3" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <CardHeader icon={Users} title="Recent Client Queries" subtitle="Latest client inquiries, projects and their status." action={viewAll("/queries")} />
          {queries.length === 0 ? (
            <EmptyState
              icon={Hourglass}
              title="No queries yet"
              text="Add a client and log their first query to see it here."
              action={<Link href="/clients?new=1" className="btn btn-primary">Add client</Link>}
            />
          ) : (
            <div className="overflow-x-auto px-3 pb-3">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Service / Query</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((q) => {
                    const c = q.client as ClientT | null;
                    const late = isOverdue(q.dueDate, ["Completed", "Closed"].includes(q.status));
                    return (
                      <tr key={q._id}>
                        <td>
                          <Link href={c ? `/clients/${c._id}` : "/queries"} className="flex items-center gap-3">
                            <Avatar name={c?.name} />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-heading">{c?.name || "Deleted client"}</div>
                              <div className="truncate text-xs text-muted">{c?.company || c?.website}</div>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <div className="max-w-[220px] truncate text-fg">{q.title}</div>
                          <div className="text-xs text-muted">{q.service}</div>
                        </td>
                        <td>
                          <Badge status={late ? "Overdue" : q.status} />
                        </td>
                        <td className="whitespace-nowrap text-fg">{q.assignedTo || "—"}</td>
                        <td className="whitespace-nowrap font-semibold text-heading">{q.amount ? formatMoney(q.amount, cur) : "—"}</td>
                        <td className="whitespace-nowrap text-muted">{formatDate(q.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <CardHeader icon={FileText} title="Recent Invoices" subtitle="Latest invoices and payment status." action={viewAll("/invoices")} />
          {invoices.length === 0 ? (
            <EmptyState icon={FileText} title="No invoices yet" action={<Link href="/invoices/new" className="btn btn-primary">Create invoice</Link>} />
          ) : (
            <ul className="divide-y divide-line px-5 pb-3">
              {invoices.map((i) => (
                <li key={i._id}>
                  <Link href={`/invoices/${i._id}`} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="whitespace-nowrap text-sm font-bold text-heading">{i.invoiceNumber}</div>
                      <div className="truncate text-xs text-muted">{i.clientSnapshot?.company || i.clientSnapshot?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-heading">{formatMoney(i.totals?.total, i.currency)}</div>
                      <div className="text-[11px] text-muted">{formatDate(i.issueDate)}</div>
                    </div>
                    <Badge status={i.status} className="w-[104px] justify-center" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
