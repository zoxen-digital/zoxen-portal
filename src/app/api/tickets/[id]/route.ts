import { Ticket } from "@/models/Ticket";
import { User } from "@/models/User";
import { Message } from "@/models/Message";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, STAFF, apiUser } from "@/lib/session";
import { logTicket, ticketFor } from "@/lib/tickets";
import { clientUserIds, notify } from "@/lib/notify";
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  const ticket = await ticketFor(user, id);
  const b = await req.json().catch(() => ({}));
  const before = { status: ticket.status, assignee: ticket.assignee ? String(ticket.assignee) : "" };

  if ("status" in b) {
    if (!TICKET_STATUSES.includes(b.status)) return error("Invalid status");
    ticket.status = b.status;
    ticket.resolvedAt = ["Resolved", "Closed"].includes(b.status) ? ticket.resolvedAt || new Date() : undefined;
  }
  if ("priority" in b) {
    if (!TICKET_PRIORITIES.includes(b.priority)) return error("Invalid priority");
    ticket.priority = b.priority;
  }
  if ("type" in b) {
    if (!TICKET_TYPES.includes(b.type)) return error("Invalid type");
    ticket.type = b.type;
  }
  if ("title" in b) {
    const t = String(b.title || "").trim();
    if (!t) return error("Add a short title");
    ticket.title = t.slice(0, 200);
  }
  if ("dueDate" in b) ticket.dueDate = b.dueDate ? new Date(b.dueDate) : undefined;
  if ("assignee" in b) {
    if (b.assignee) {
      if (!validId(String(b.assignee)) || !(await User.exists({ _id: b.assignee, role: { $in: ["team_admin", "super_admin"] }, status: "active" }))) {
        return error("Choose an active team member");
      }
      ticket.assignee = b.assignee;
    } else {
      ticket.assignee = undefined;
    }
  }
  await ticket.save();

  const now = { status: ticket.status, assignee: ticket.assignee ? String(ticket.assignee) : "" };
  if (now.status !== before.status) {
    await logTicket(ticket, user, `${ticket.number}: ${now.status}`);
    const resolved = now.status === "Resolved";
    await notify(await clientUserIds(String(ticket.client)), {
      title: `${ticket.number} ${resolved ? "resolved" : `is now ${now.status}`}`,
      body: resolved ? `${ticket.title}. Please check and close it, or reply if something is still wrong.` : ticket.title,
      link: `/portal/tickets/${ticket._id}`,
      email: resolved || now.status === "Waiting on Client" ? { button: "View ticket" } : undefined,
    });
  }
  if (now.assignee && now.assignee !== before.assignee && now.assignee !== user.id) {
    await notify([now.assignee], { title: `Assigned to you: ${ticket.number}`, body: ticket.title, link: `/tickets/${ticket._id}` });
  }
  return json(ticket);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await Message.deleteMany({ ticket: id });
  await Ticket.findByIdAndDelete(id);
  return json({ ok: true });
});
