import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models/Ticket";
import { Client } from "@/models/Client";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { nextNumber, cleanAttachments } from "@/lib/docs";
import { announceNewTicket, defaultAssignee, defaultDue, logTicket, ticketScope } from "@/lib/tickets";
import { TICKET_PRIORITIES, TICKET_TYPES } from "@/lib/constants";

export const GET = handle(async () => {
  const user = await apiUser(STAFF);
  await dbConnect();
  const tickets = await Ticket.find(await ticketScope(user)).sort({ updatedAt: -1 }).limit(500).populate("client", "name company").lean();
  return json(tickets);
});

/** Staff opens a ticket for a client (e.g. reported on a call). */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(STAFF);
  await dbConnect();
  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return error("Add a short title");
  if (!b.client || !validId(String(b.client)) || !(await Client.exists({ _id: b.client }))) return error("Choose a client");
  let project: { _id: unknown } | null = null;
  if (b.project && validId(String(b.project))) {
    project = await Project.findOne({ _id: b.project, client: b.client, ...(user.role === "team_admin" ? { team: user.id } : {}) }).select("_id").lean<{ _id: unknown }>();
    if (!project) return error("Project not found");
  } else if (user.role === "team_admin") {
    return error("Choose one of your projects");
  }
  const type = TICKET_TYPES.includes(b.type) ? b.type : "Bug";
  const priority = TICKET_PRIORITIES.includes(b.priority) ? b.priority : "Medium";
  let assignee = b.assignee && validId(String(b.assignee)) ? String(b.assignee) : user.role === "team_admin" ? user.id : await defaultAssignee(project?._id);
  if (assignee && !(await User.exists({ _id: assignee, role: { $in: ["team_admin", "super_admin"] } }))) assignee = undefined;

  const ticket = await Ticket.create({
    number: await nextNumber(Ticket, "T", "number", false),
    client: b.client,
    project: project?._id,
    title,
    description: typeof b.description === "string" ? b.description.trim().slice(0, 5000) : "",
    type,
    priority,
    status: "Open",
    assignee,
    dueDate: b.dueDate ? new Date(b.dueDate) : defaultDue(priority),
    createdByName: user.name,
    createdByRole: user.role,
    attachments: cleanAttachments(b.attachments),
  });
  await logTicket(ticket, user, `Ticket ${ticket.number} opened: ${title}`);
  await announceNewTicket(ticket, user);
  return json(ticket, 201);
});
