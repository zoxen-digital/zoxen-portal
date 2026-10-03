import { dbConnect } from "./db";
import { Activity } from "@/models/Activity";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Meeting } from "@/models/Meeting";
import { Project } from "@/models/Project";
import { Ticket } from "@/models/Ticket";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ReportData = {
  month: string;
  label: string;
  client: { name: string; company?: string };
  projects: {
    title: string;
    stage: string;
    progress: number;
    tasksDone: string[];
    revisionsRequested: number;
    revisionsDone: number;
    updates: string[];
  }[];
  invoices: { number: string; total: number; currency: string; status: string; date: string }[];
  payments: { invoice: string; amount: number; currency: string; date: string }[];
  meetings: { title: string; date: string }[];
  tickets: { opened: number; resolved: number; list: { number: string; title: string; status: string }[] };
  totals: { invoiced: Record<string, number>; paid: Record<string, number> };
};

/** "2026-09" for last month (the usual report). */
export function lastMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export function validMonth(m?: string) {
  return m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : lastMonth();
}

/** What happened for one client during one calendar month (UTC). */
export async function buildReport(clientId: string, month: string): Promise<ReportData | null> {
  await dbConnect();
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const inMonth = (d?: Date | string | null) => !!d && new Date(d) >= start && new Date(d) < end;

  const client = await Client.findById(clientId).select("name company").lean<{ name: string; company?: string }>();
  if (!client) return null;

  const [projects, invoices, meetings, tickets, activity] = await Promise.all([
    Project.find({ client: clientId, createdAt: { $lt: end } }).lean<any[]>(),
    Invoice.find({ client: clientId, status: { $nin: ["Draft", "Cancelled"] } }).lean<any[]>(),
    Meeting.find({ client: clientId, status: "Scheduled", date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean<any[]>(),
    Ticket.find({ client: clientId, $or: [{ createdAt: { $gte: start, $lt: end } }, { resolvedAt: { $gte: start, $lt: end } }] }).lean<any[]>(),
    Activity.find({ client: clientId, visibleToClient: true, createdAt: { $gte: start, $lt: end }, text: /^Status updated/ }).sort({ createdAt: 1 }).lean<any[]>(),
  ]);

  const projectRows = projects
    .map((p) => ({
      title: p.title,
      stage: p.stage,
      progress: p.progress || 0,
      tasksDone: (p.checklist || []).filter((c: any) => c.done && inMonth(c.doneAt)).map((c: any) => c.label),
      revisionsRequested: (p.revisions || []).filter((r: any) => inMonth(r.createdAt)).length,
      revisionsDone: (p.revisions || []).filter((r: any) => inMonth(r.completedAt)).length,
      updates: activity.filter((a) => String(a.project) === String(p._id)).map((a) => String(a.text).replace(/^Status updated to /, "")),
    }))
    // Only projects that were active or touched this month.
    .filter((p, i) => {
      const raw = projects[i];
      return !["Completed"].includes(raw.stage) || p.tasksDone.length || p.revisionsRequested || p.revisionsDone || p.updates.length || inMonth(raw.updatedAt);
    });

  const invoiceRows = invoices
    .filter((i) => inMonth(i.issueDate))
    .map((i) => ({ number: i.invoiceNumber, total: i.totals?.total || 0, currency: i.currency, status: i.status, date: new Date(i.issueDate).toISOString() }));
  const payments = invoices.flatMap((i) =>
    (i.payments || []).filter((p: any) => inMonth(p.date)).map((p: any) => ({ invoice: i.invoiceNumber, amount: p.amount, currency: i.currency, date: new Date(p.date).toISOString() }))
  );
  const sum = (rows: { currency: string }[], key: "total" | "amount") =>
    rows.reduce<Record<string, number>>((acc, r: any) => ((acc[r.currency] = (acc[r.currency] || 0) + r[key]), acc), {});

  return {
    month,
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    client,
    projects: projectRows,
    invoices: invoiceRows,
    payments,
    meetings: meetings.map((mt) => ({ title: mt.title, date: new Date(mt.date).toISOString() })),
    tickets: {
      opened: tickets.filter((t) => inMonth(t.createdAt)).length,
      resolved: tickets.filter((t) => inMonth(t.resolvedAt)).length,
      list: tickets.map((t) => ({ number: t.number, title: t.title, status: t.status })),
    },
    totals: { invoiced: sum(invoiceRows, "total"), paid: sum(payments, "amount") },
  };
}
