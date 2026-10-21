import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { error, handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { teamClientIds } from "@/lib/inbox";
import { gemini, scrub } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";
import { converter } from "@/lib/fx";
import { Client } from "@/models/Client";
import { Conversation } from "@/models/Conversation";
import { Invoice } from "@/models/Invoice";
import { Meeting } from "@/models/Meeting";
import { Message } from "@/models/Message";
import { Onboarding } from "@/models/Onboarding";
import { Project } from "@/models/Project";
import { Query } from "@/models/Query";
import { User } from "@/models/User";

/* eslint-disable @typescript-eslint/no-explicit-any */

const day = (d?: Date | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-");

/** Everything the assistant needs to know about one client, as short plain text (no emails or phone numbers). */
async function clientBrief(c: any, money: boolean) {
  const id = c._id;
  const [projects, invoices, msgs, queries, onboarding, conv] = await Promise.all([
    Project.find({ client: id }).select("title stage progress dueDate revisions issues team").populate("team", "name").sort({ updatedAt: -1 }).limit(6).lean<any[]>(),
    money ? Invoice.find({ client: id, status: { $ne: "Cancelled" } }).select("invoiceNumber status totals currency dueDate issueDate").sort({ issueDate: -1 }).limit(8).lean<any[]>() : Promise.resolve([]),
    Message.find({ client: id, ticket: null, internal: { $ne: true } }).sort({ createdAt: -1 }).limit(10).lean<any[]>(),
    Query.find({ client: id, status: { $in: ["Pending", "In Progress"] } }).select("title status assignedTo dueDate").limit(5).lean<any[]>(),
    Onboarding.findOne({ client: id }).select("status createdAt").sort({ createdAt: -1 }).lean<any>(),
    Conversation.findOne({ client: id }).select("assignedTo priority lastClientAt lastTeamAt").populate("assignedTo", "name").lean<any>(),
  ]);
  const lines = [`CLIENT: ${c.company || c.name} (contact: ${c.name}), status ${c.status || "Active"}, client since ${day(c.createdAt)}`];
  lines.push(
    projects.length
      ? "Projects:\n" +
          projects
            .map((p) => {
              const openIssues = (p.issues || []).filter((i: any) => i.status !== "Resolved").length;
              const revisions = (p.revisions || []).filter((r: any) => r.status === "Requested").length;
              return `- ${p.title}: stage ${p.stage}, ${p.progress ?? 0}% done, due ${day(p.dueDate)}, team ${(p.team || []).map((t: any) => t.name).join(", ") || "none"}${openIssues ? `, ${openIssues} open issue(s)` : ""}${revisions ? `, ${revisions} revision request(s) waiting` : ""}`;
            })
            .join("\n")
      : "Projects: none"
  );
  if (money) {
    lines.push(
      invoices.length
        ? "Invoices:\n" + invoices.map((i) => `- ${i.invoiceNumber}: ${i.status}, total ${formatMoney(i.totals?.total, i.currency)}, balance ${formatMoney(i.totals?.balance, i.currency)}, issued ${day(i.issueDate)}, due ${day(i.dueDate)}`).join("\n")
        : "Invoices: none"
    );
  }
  lines.push(queries.length ? "Open requests:\n" + queries.map((q) => `- ${q.title} (${q.status}${q.assignedTo ? `, ${q.assignedTo}` : ""}, due ${day(q.dueDate)})`).join("\n") : "Open requests: none");
  lines.push(`Onboarding form: ${onboarding ? `${onboarding.status} (${day(onboarding.createdAt)})` : "not submitted"}`);
  if (conv) {
    const waiting = conv.lastClientAt && (!conv.lastTeamAt || new Date(conv.lastClientAt) > new Date(conv.lastTeamAt));
    lines.push(`Chat: assigned to ${conv.assignedTo?.name || "nobody"}, priority ${conv.priority}${waiting ? `, client waiting for a reply since ${day(conv.lastClientAt)}` : ""}`);
  }
  if (msgs.length) {
    lines.push(
      "Recent chat (newest last):\n" +
        msgs
          .reverse()
          .map((m) => `- ${day(m.createdAt)} ${m.authorRole === "client" ? "Client" : m.authorName || "Team"}: ${scrub(m.body) || "(file)"}`)
          .join("\n")
    );
  }
  return lines.join("\n");
}

/** Agency-wide snapshot when the question is not about one client. */
async function agencyBrief(scope: Record<string, unknown>, money: boolean, cur: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [projects, waitingChats, meetings, openQueries, overdue, monthAgg] = await Promise.all([
    Project.find({ ...scope, stage: { $nin: ["Live", "Completed"] } }).select("title stage progress dueDate client").populate("client", "name company").sort({ dueDate: 1 }).limit(15).lean<any[]>(),
    Conversation.find({ ...scope, lastClientAt: { $ne: null } }).select("client lastClientAt lastTeamAt").populate("client", "name company").sort({ lastClientAt: -1 }).limit(30).lean<any[]>(),
    Meeting.find({ ...scope, status: "Scheduled", date: { $gte: now, $lte: new Date(now.getTime() + 7 * 86_400_000) } }).select("title date client").populate("client", "name company").limit(10).lean<any[]>(),
    Query.countDocuments({ ...scope, status: { $in: ["Pending", "In Progress"] } }),
    money ? Invoice.find({ status: { $in: ["Unpaid", "Partially Paid"] }, "totals.balance": { $gt: 0 } }).select("invoiceNumber totals currency dueDate clientSnapshot").sort({ dueDate: 1 }).limit(10).lean<any[]>() : Promise.resolve([]),
    money ? Invoice.aggregate([{ $unwind: "$payments" }, { $match: { "payments.date": { $gte: monthStart } } }, { $group: { _id: "$currency", total: { $sum: "$payments.amount" } } }]) : Promise.resolve([]),
  ]);
  const who = (c: any) => c?.company || c?.name || "client";
  const waiting = waitingChats.filter((c) => !c.lastTeamAt || new Date(c.lastClientAt) > new Date(c.lastTeamAt));
  const lines = [
    `Active projects (${projects.length}):\n` + (projects.map((p) => `- ${p.title} for ${who(p.client)}: ${p.stage}, ${p.progress ?? 0}%, due ${day(p.dueDate)}`).join("\n") || "none"),
    `Chats waiting for our reply (${waiting.length}): ` + (waiting.slice(0, 8).map((c) => `${who(c.client)} since ${day(c.lastClientAt)}`).join("; ") || "none"),
    `Meetings next 7 days: ` + (meetings.map((m) => `${m.title} with ${who(m.client)} on ${day(m.date)}`).join("; ") || "none"),
    `Open requests/queries: ${openQueries}`,
  ];
  if (money) {
    const fx = await converter(cur);
    const collected = (monthAgg as { _id: string | null; total: number }[]).reduce((a, r) => a + fx(r.total, r._id || cur), 0);
    lines.push(`Collected this month: ${formatMoney(collected, cur)} (other currencies converted at today's rate)`);
    lines.push(`Unpaid invoices:\n` + (overdue.map((i) => `- ${i.invoiceNumber} ${i.clientSnapshot?.company || i.clientSnapshot?.name}: balance ${formatMoney(i.totals?.balance, i.currency)}, due ${day(i.dueDate)}`).join("\n") || "none"));
  }
  return lines.join("\n\n");
}

/**
 * "Ask AI" side panel: answers questions about clients and the agency from portal data.
 * Super admins see everything; team members only clients they work with, and no money figures.
 */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(STAFF);
  const b = await req.json().catch(() => ({}));
  const question = typeof b.question === "string" ? b.question.trim().slice(0, 500) : "";
  if (!question) return error("Ask a question");
  const history = (Array.isArray(b.history) ? b.history : [])
    .filter((t: any) => (t?.role === "user" || t?.role === "model") && typeof t.text === "string")
    .slice(-6)
    .map((t: any) => ({ role: t.role, text: String(t.text).slice(0, 1500) }));
  await dbConnect();
  const settings = await getSettings();
  const owner = user.role === "super_admin";
  const allowed = owner ? null : await teamClientIds(user);
  const clientFilter = allowed ? { _id: { $in: allowed } } : {};
  const scope = allowed ? { client: { $in: allowed.map((x) => new Types.ObjectId(String(x))) } } : {};

  // Which clients is the question about? Match names/companies mentioned in it (or in the last answer's question).
  const clients = await Client.find(clientFilter).select("name company status createdAt").limit(1000).lean<any[]>();
  const hay = (question + " " + history.filter((h: any) => h.role === "user").slice(-1).map((h: any) => h.text).join(" ")).toLowerCase();
  const matched = clients
    .map((c) => {
      const names = [c.company, c.name].filter((n: string) => n && n.length >= 3).map((n: string) => n.toLowerCase());
      const score = Math.max(0, ...names.map((n: string) => (hay.includes(n) ? n.length : n.split(/\s+/).some((w: string) => w.length >= 4 && hay.includes(w)) ? 1 : 0)));
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.c);

  const context = matched.length ? (await Promise.all(matched.map((c) => clientBrief(c, owner)))).join("\n\n---\n\n") : await agencyBrief(scope, owner, settings.defaultCurrency);
  const me = await User.findById(user.id).select("name").lean<{ name: string }>();

  const answer = await gemini({
    system: `You are the internal assistant of ${settings.companyName || "the agency"}'s client portal, talking to ${me?.name || user.name} (${owner ? "owner/super admin" : "team member"}).
Today is ${new Date().toDateString()}.
Answer ONLY from the DATA below. If something is not in the data, say you don't have it. Never invent numbers, dates or names.
Reply in the same language and script the user writes in (English, or Roman Urdu if they write Roman Urdu).
Be short and practical: a one-line answer first, then up to 6 bullet points, then "Next step:" with one clear action when useful.
${owner ? "" : "Do not discuss invoice amounts or payments; say the owner handles billing if asked."}

DATA:
${context}`,
    turns: [...history, { role: "user", text: question }],
    temperature: 0.3,
    maxTokens: 900,
  });
  return json({ answer, about: matched.map((c) => c.company || c.name) });
});
