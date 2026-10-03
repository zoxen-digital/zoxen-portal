import { error, handle, json } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { logTicket, ticketFor } from "@/lib/tickets";
import { notify, superAdminIds } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

/** Client closes a resolved ticket, or reopens it when the problem is back. Body: { action: "close" | "reopen" } */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(["client"]);
  const { id } = await params;
  const ticket = await ticketFor(user, id);
  const { action } = await req.json().catch(() => ({}));
  if (action === "close") {
    ticket.status = "Closed";
    ticket.resolvedAt = ticket.resolvedAt || new Date();
  } else if (action === "reopen") {
    if (!["Resolved", "Closed"].includes(ticket.status)) return error("This ticket is still open");
    ticket.status = "Open";
    ticket.resolvedAt = undefined;
  } else {
    return error("Unknown action");
  }
  await ticket.save();
  await logTicket(ticket, user, `${user.name} ${action === "close" ? "closed" : "reopened"} ${ticket.number}`);
  const staff = [...new Set([...(ticket.assignee ? [String(ticket.assignee)] : []), ...(await superAdminIds())])];
  await notify(staff, {
    title: `${ticket.number} ${action === "close" ? "closed" : "reopened"} by client`,
    body: ticket.title,
    link: `/tickets/${ticket._id}`,
  });
  return json(ticket);
});
