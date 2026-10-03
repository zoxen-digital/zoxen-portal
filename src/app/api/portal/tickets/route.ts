import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models/Ticket";
import { Project } from "@/models/Project";
import { error, handle, json, validId } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { cleanAttachments, nextNumber } from "@/lib/docs";
import { announceNewTicket, defaultAssignee, defaultDue, logTicket } from "@/lib/tickets";
import { TICKET_PRIORITIES, TICKET_TYPES } from "@/lib/constants";

/** Client opens a support ticket from the portal. */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["client"]);
  await dbConnect();
  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return error("Add a short title for your request");
  const description = typeof b.description === "string" ? b.description.trim().slice(0, 5000) : "";
  if (description.length < 5) return error("Please describe what you need");
  let project: { _id: unknown } | null = null;
  if (b.project && validId(String(b.project))) {
    project = await Project.findOne({ _id: b.project, client: user.clientId }).select("_id").lean<{ _id: unknown }>();
    if (!project) return error("Project not found");
  }
  // Clients cannot set Urgent; the team can raise it.
  const priority = TICKET_PRIORITIES.includes(b.priority) && b.priority !== "Urgent" ? b.priority : "Medium";
  const ticket = await Ticket.create({
    number: await nextNumber(Ticket, "T", "number", false),
    client: user.clientId,
    project: project?._id,
    title,
    description,
    type: TICKET_TYPES.includes(b.type) ? b.type : "Bug",
    priority,
    status: "Open",
    assignee: await defaultAssignee(project?._id),
    dueDate: defaultDue(priority),
    createdByName: user.name,
    createdByRole: "client",
    attachments: cleanAttachments(b.attachments),
  });
  await logTicket(ticket, user, `${user.name} opened ticket ${ticket.number}: ${title}`);
  await announceNewTicket(ticket, user);
  return json(ticket, 201);
});
