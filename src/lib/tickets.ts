import { Types } from "mongoose";
import { HttpError, validId } from "./api";
import { dbConnect } from "./db";
import { addDays } from "./docs";
import { clientUserIds, notify, superAdminIds } from "./notify";
import type { CurrentUser } from "./session";
import { Project } from "@/models/Project";
import { Ticket } from "@/models/Ticket";
import { Activity } from "@/models/Activity";

/** How long each priority may stay open before it counts as overdue. */
const DUE_DAYS: Record<string, number> = { Urgent: 1, High: 2, Medium: 5, Low: 10 };

export function defaultDue(priority: string) {
  return addDays(new Date(), DUE_DAYS[priority] ?? 5);
}

/** Tickets a user may see: owners all, team their own or their projects', clients their company's. */
export async function ticketScope(user: CurrentUser): Promise<Record<string, unknown>> {
  if (user.role === "super_admin" || user.role === "agent") return {};
  if (user.role === "client") return { client: new Types.ObjectId(user.clientId || "000000000000000000000000") };
  const projects = await Project.find({ team: user.id }).select("_id").lean();
  return { $or: [{ assignee: new Types.ObjectId(user.id) }, { project: { $in: projects.map((p) => p._id) } }] };
}

export async function ticketFor(user: CurrentUser, id: string) {
  if (!validId(id)) throw new HttpError("Ticket not found", 404);
  await dbConnect();
  const ticket = await Ticket.findOne({ _id: id, ...(await ticketScope(user)) });
  if (!ticket) throw new HttpError("Ticket not found", 404);
  return ticket;
}

/** First team member on the linked project picks up new client tickets by default. */
export async function defaultAssignee(projectId?: unknown) {
  if (!projectId) return undefined;
  const p = await Project.findById(projectId).select("team").lean<{ team?: unknown[] }>();
  return p?.team?.[0] ? String(p.team[0]) : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logTicket(ticket: any, actor: { name: string; role: string }, text: string, visibleToClient = true) {
  try {
    await Activity.create({ client: ticket.client, project: ticket.project, actor: actor.name, actorRole: actor.role, text, visibleToClient });
  } catch (e) {
    console.error("Activity log failed:", e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function announceNewTicket(ticket: any, by: CurrentUser) {
  const staffLink = `/tickets/${ticket._id}`;
  const title = `New ${ticket.priority === "Urgent" ? "URGENT " : ""}ticket ${ticket.number}: ${ticket.title}`;
  if (by.role === "client") {
    const admins = await superAdminIds();
    await notify(admins, { title, body: `${by.name} · ${ticket.type} · ${ticket.priority}`, link: staffLink, email: { button: "Open ticket" } });
    const assignee = ticket.assignee ? String(ticket.assignee) : null;
    if (assignee && !admins.includes(assignee)) {
      await notify([assignee], { title: `Assigned to you: ${ticket.number}`, body: ticket.title, link: staffLink, email: { button: "Open ticket" } });
    }
  } else {
    await notify(await clientUserIds(String(ticket.client)), {
      title: `Support ticket opened: ${ticket.number}`,
      body: `${ticket.title}. Our team is on it. You can follow it in your portal.`,
      link: `/portal/tickets/${ticket._id}`,
    });
    if (ticket.assignee && String(ticket.assignee) !== by.id) {
      await notify([String(ticket.assignee)], { title: `Assigned to you: ${ticket.number}`, body: ticket.title, link: staffLink });
    }
  }
}
