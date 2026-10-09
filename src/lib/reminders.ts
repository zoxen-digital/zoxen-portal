import { dbConnect } from "./db";
import { invoiceReminderMessage, notifyClient } from "./client-notify";
import { clientUserIds, notify, superAdminIds } from "./notify";
import { runDuePlans } from "./recurring";
import { staffSummary } from "./today";
import { Invoice } from "@/models/Invoice";
import { Meeting } from "@/models/Meeting";
import { Project } from "@/models/Project";
import { Quote } from "@/models/Quote";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { LoginEvent } from "@/models/LoginEvent";
import { Expense } from "@/models/Expense";
import { nextRenewal } from "./expenses";
import { formatMoney } from "./utils";

const DAY = 86_400_000;
const SYSTEM = { name: "Automatic reminder", role: "system" };

/** Overdue invoices get a reminder 3, 7 and 14 days after the due date (each only once). */
const STEPS = [3, 7, 14];

async function overdueInvoices() {
  const now = Date.now();
  const list = await Invoice.find({
    status: { $in: ["Unpaid", "Partially Paid"] },
    "totals.balance": { $gt: 0 },
    dueDate: { $lt: new Date(now - STEPS[0]! * DAY) },
    autoReminderStage: { $lt: STEPS.length },
  }).limit(300);
  let sent = 0;
  for (const inv of list) {
    const daysLate = Math.floor((now - new Date(inv.dueDate).getTime()) / DAY);
    // Highest step reached that has not been sent yet (a long-overdue invoice gets one reminder, not three).
    let stage = 0;
    STEPS.forEach((d, i) => daysLate >= d && (stage = i + 1));
    if (stage <= (inv.autoReminderStage || 0)) continue;
    // Claim first, so a second run the same day cannot send it again.
    const claimed = await Invoice.findOneAndUpdate(
      { _id: inv._id, autoReminderStage: inv.autoReminderStage || 0 },
      { $set: { autoReminderStage: stage, lastReminderAt: new Date() }, $inc: { reminderCount: 1 } }
    );
    if (!claimed) continue;
    const via = await notifyClient(String(inv.client), invoiceReminderMessage(inv), SYSTEM);
    if (via !== "none") sent++;
  }
  return sent;
}

/** Work waiting on the client's review for 2+ days: nudge every 2 days. */
async function pendingReviews() {
  const cutoff = new Date(Date.now() - 2 * DAY);
  const list = await Project.find({
    stage: "Client Review",
    stageChangedAt: { $lte: cutoff },
    $or: [{ reviewReminderAt: null }, { reviewReminderAt: { $lte: cutoff } }],
  }).limit(200);
  for (const p of list) {
    await Project.updateOne({ _id: p._id }, { $set: { reviewReminderAt: new Date() } });
    await notify(await clientUserIds(String(p.client)), {
      title: `Reminder: ${p.title} is waiting for your review`,
      body: "Please take a look and approve it or request changes, so we can keep your project on schedule.",
      link: `/portal/projects/${p._id}`,
      email: { button: "Review now" },
    });
  }
  return list.length;
}

/** Meetings in the next ~26 hours: remind the client and the team once. */
async function upcomingMeetings() {
  const now = new Date();
  const list = await Meeting.find({
    status: "Scheduled",
    date: { $gte: now, $lte: new Date(now.getTime() + 26 * 60 * 60 * 1000) },
    reminderSentAt: null,
  }).limit(200);
  const admins = await superAdminIds();
  for (const m of list) {
    const claimed = await Meeting.findOneAndUpdate({ _id: m._id, reminderSentAt: null }, { $set: { reminderSentAt: new Date() } });
    if (!claimed) continue;
    await notify(await clientUserIds(String(m.client)), {
      title: `Reminder: ${m.title}`,
      body: `Your meeting with us is coming up. See the time${m.link ? " and joining link" : ""} in your portal.`,
      link: "/portal",
      email: { button: "View meeting" },
    });
    let team = admins;
    if (m.project) {
      const p = await Project.findById(m.project).select("team").lean<{ team?: unknown[] }>();
      team = [...new Set([...admins, ...(p?.team || []).map(String)])];
    }
    await notify(team, { title: `Meeting soon: ${m.title}`, body: "Check the client page for details.", link: `/clients/${m.client}` });
  }
  return list.length;
}

async function expireQuotes() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const r = await Quote.updateMany({ status: "Sent", validUntil: { $lt: today } }, { $set: { status: "Expired" } });
  return r.modifiedCount;
}

/** Morning push to each staff member who has overdue or due-today work. */
async function staffDigest() {
  const staff = await User.find({ role: { $in: ["super_admin", "team_admin"] }, status: "active" }).select("name role").lean<{ _id: unknown; name: string; role: "super_admin" | "team_admin" }[]>();
  let sent = 0;
  for (const u of staff) {
    const s = await staffSummary({ id: String(u._id), name: u.name, role: u.role, email: "" });
    const parts = [
      s.overdue && `${s.overdue} overdue`,
      s.dueToday && `${s.dueToday} due today`,
      s.waitingOnTeam && `${s.waitingOnTeam} waiting on you`,
    ].filter(Boolean);
    if (!parts.length) continue;
    await notify([String(u._id)], { title: `Good morning ${u.name.split(" ")[0]}: ${parts.join(", ")}`, body: "Open My Day to see the list.", link: "/today" });
    sent++;
  }
  return sent;
}

/** Morning summary for the owner: who did what in the last 24 hours, deletions and security events. */
async function ownerSummary() {
  const owners = await User.find({ role: "agent", status: "active" }).select("_id").lean();
  if (!owners.length) return 0;
  const since = new Date(Date.now() - 86_400_000);
  const [byPerson, deletes, failed, newDevices] = await Promise.all([
    AuditLog.aggregate([
      { $match: { at: { $gte: since }, actorRole: { $in: ["super_admin", "team_admin"] } } },
      { $group: { _id: "$actorName", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    AuditLog.countDocuments({ at: { $gte: since }, method: "DELETE" }),
    LoginEvent.countDocuments({ at: { $gte: since }, success: false }),
    LoginEvent.countDocuments({ at: { $gte: since }, newDevice: true }),
  ]);
  const people = byPerson.map((p: { _id: string; n: number }) => `${p._id} (${p.n})`).join(", ");
  const body = [
    byPerson.length ? `Activity: ${people}.` : "No admin or team activity.",
    `${deletes} deletion${deletes === 1 ? "" : "s"}`,
    `${failed} failed sign-in${failed === 1 ? "" : "s"}`,
    `${newDevices} new device${newDevices === 1 ? "" : "s"}`,
  ].join(" · ");
  await notify(
    owners.map((o) => String(o._id)),
    { title: "Daily summary: last 24 hours", body, link: "/agent/audit", email: { button: "Open audit log" } }
  );
  return 1;
}

/** Subscriptions renewing within 7 days: remind super admins once per renewal, then roll past dates forward. */
async function expenseRenewals() {
  const list = await Expense.find({ active: true, cycle: { $ne: "One-time" }, renewsOn: { $ne: null } }).limit(500);
  const admins = await superAdminIds();
  let sent = 0;
  for (const e of list) {
    let due = new Date(e.renewsOn);
    // Renewal passed: it was paid, move to the next date.
    if (due.getTime() < Date.now() - 86_400_000) {
      due = nextRenewal(due, e.cycle);
      await Expense.updateOne({ _id: e._id }, { $set: { renewsOn: due } });
    }
    const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
    if (days > 7 || (e.reminderFor && new Date(e.reminderFor).getTime() === due.getTime())) continue;
    await Expense.updateOne({ _id: e._id }, { $set: { reminderFor: due } });
    await notify(admins, {
      title: `Renewal ${days <= 0 ? "due today" : `in ${days} day${days === 1 ? "" : "s"}`}: ${e.title}`,
      body: `${formatMoney(e.amount, e.currency)}${e.vendor ? ` to ${e.vendor}` : ""}. Make sure the card has funds so nothing goes offline.`,
      link: "/expenses",
    });
    sent++;
  }
  return sent;
}

/** Everything the daily job does. Each part is isolated so one failure does not stop the rest. */
export async function runDailyJobs() {
  await dbConnect();
  const result: Record<string, number | string> = {};
  const jobs: [string, () => Promise<number>][] = [
    ["recurringInvoices", runDuePlans],
    ["invoiceReminders", overdueInvoices],
    ["reviewReminders", pendingReviews],
    ["meetingReminders", upcomingMeetings],
    ["expiredQuotes", expireQuotes],
    ["staffDigests", staffDigest],
    ["ownerSummary", ownerSummary],
    ["expenseRenewals", expenseRenewals],
  ];
  for (const [name, job] of jobs) {
    try {
      result[name] = await job();
    } catch (e) {
      console.error(`Daily job ${name} failed:`, e);
      result[name] = `error: ${e instanceof Error ? e.message : "failed"}`;
    }
  }
  return result;
}
