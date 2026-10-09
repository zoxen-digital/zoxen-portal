import { Types } from "mongoose";
import { dbConnect } from "./db";
import { projectScope } from "./projects";
import { ticketScope } from "./tickets";
import { OPEN_STAGES, OPEN_TICKET_STATUSES } from "./constants";
import type { CurrentUser } from "./session";
import { Project } from "@/models/Project";
import { Ticket } from "@/models/Ticket";
import { Query } from "@/models/Query";
import { Meeting } from "@/models/Meeting";
import { Message } from "@/models/Message";

export type TodayItem = {
  key: string;
  kind: "Project" | "Issue" | "Revision" | "Ticket" | "Query" | "Meeting" | "Message";
  title: string;
  sub: string;
  href: string;
  due?: string;
};

export type TodayData = {
  overdue: TodayItem[];
  dueToday: TodayItem[];
  waitingOnTeam: TodayItem[];
  waitingOnClient: TodayItem[];
  meetings: TodayItem[];
  blocked: TodayItem[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function bounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/** Everything one staff member should look at today. Owners see the whole agency; team members only their work. */
export async function today(user: CurrentUser): Promise<TodayData> {
  await dbConnect();
  const { start, end } = bounds();
  const owner = user.role === "super_admin" || user.role === "agent";
  const scope = projectScope(user);
  const out: TodayData = { overdue: [], dueToday: [], waitingOnTeam: [], waitingOnClient: [], meetings: [], blocked: [] };

  const [projects, tickets, queries] = await Promise.all([
    Project.find({ ...scope, stage: { $in: OPEN_STAGES } }).populate("client", "name company").lean<any[]>(),
    Ticket.find({ ...(await ticketScope(user)), status: { $in: OPEN_TICKET_STATUSES } }).populate("client", "name company").lean<any[]>(),
    Query.find({ ...(owner ? {} : { assignedTo: user.name }), status: { $in: ["Pending", "In Progress"] }, dueDate: { $lt: end } })
      .populate("client", "name company")
      .lean<any[]>(),
  ]);
  const who = (c: any) => (c ? c.company || c.name : "Client");
  const bucket = (due: Date | undefined, item: TodayItem) => {
    if (!due) return;
    const d = new Date(due);
    if (d < start) out.overdue.push({ ...item, due: d.toISOString() });
    else if (d < end) out.dueToday.push({ ...item, due: d.toISOString() });
  };

  for (const p of projects) {
    const href = `/projects/${p._id}`;
    bucket(p.dueDate, { key: `p${p._id}`, kind: "Project", title: p.title, sub: `${who(p.client)} · ${p.stage}`, href });
    if (p.stage === "Blocked") out.blocked.push({ key: `b${p._id}`, kind: "Project", title: p.title, sub: who(p.client), href });
    if (p.stage === "Client Review") out.waitingOnClient.push({ key: `r${p._id}`, kind: "Project", title: p.title, sub: `${who(p.client)} · review pending`, href });
    for (const i of p.issues || []) {
      if (i.status === "Resolved") continue;
      if (!owner && i.owner && i.owner !== user.name && i.owner !== "Client") continue;
      const item: TodayItem = { key: `i${i._id}`, kind: "Issue", title: i.title, sub: `${p.title}${i.owner ? ` · ${i.owner}` : ""}`, href };
      if (i.visibleToClient || i.owner === "Client") out.waitingOnClient.push(item);
      else bucket(i.dueDate, item);
    }
    for (const r of p.revisions || []) {
      if (r.status === "Requested") out.waitingOnTeam.push({ key: `v${r._id}`, kind: "Revision", title: `Round ${r.round}: ${String(r.request).slice(0, 80)}`, sub: p.title, href });
    }
  }

  for (const t of tickets) {
    const href = `/tickets/${t._id}`;
    const item: TodayItem = { key: `t${t._id}`, kind: "Ticket", title: `${t.number}: ${t.title}`, sub: `${who(t.client)} · ${t.priority}`, href };
    if (t.status === "Waiting on Client") out.waitingOnClient.push(item);
    else {
      bucket(t.dueDate, item);
      if (t.status === "Open" && (!t.dueDate || new Date(t.dueDate) >= end)) out.waitingOnTeam.push(item);
    }
  }

  for (const q of queries) {
    bucket(q.dueDate, { key: `q${q._id}`, kind: "Query", title: q.title, sub: `${who(q.client)}${q.assignedTo ? ` · ${q.assignedTo}` : ""}`, href: "/queries" });
  }

  // Client messages with no team reply after them.
  const ids = projects.map((p) => p._id as Types.ObjectId);
  if (ids.length) {
    const last = await Message.aggregate([
      { $match: { project: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$project", authorRole: { $first: "$authorRole" }, authorName: { $first: "$authorName" }, body: { $first: "$body" }, at: { $first: "$createdAt" } } },
      { $match: { authorRole: "client" } },
    ]);
    for (const m of last) {
      const p = projects.find((x) => String(x._id) === String(m._id));
      if (!p) continue;
      out.waitingOnTeam.push({
        key: `m${m._id}`,
        kind: "Message",
        title: `${m.authorName}: ${String(m.body || "sent a file").slice(0, 80)}`,
        sub: `${p.title} · unanswered`,
        href: `/projects/${p._id}#chat`,
        due: new Date(m.at).toISOString(),
      });
    }
  }

  const meetingFilter: Record<string, unknown> = { status: "Scheduled", date: { $gte: start, $lt: end } };
  if (!owner) meetingFilter.project = { $in: ids };
  const meetings = await Meeting.find(meetingFilter).sort({ date: 1 }).populate("client", "name company").lean<any[]>();
  out.meetings = meetings.map((m) => ({
    key: `mt${m._id}`,
    kind: "Meeting",
    title: m.title,
    sub: who(m.client),
    href: owner ? `/clients/${m.client?._id}` : m.project ? `/projects/${m.project}` : "/today",
    due: new Date(m.date).toISOString(),
  }));

  const byDue = (a: TodayItem, b: TodayItem) => (a.due || "").localeCompare(b.due || "");
  out.overdue.sort(byDue);
  out.dueToday.sort(byDue);
  return out;
}

export async function staffSummary(user: CurrentUser) {
  const d = await today(user);
  return { overdue: d.overdue.length, dueToday: d.dueToday.length, waitingOnTeam: d.waitingOnTeam.length };
}
