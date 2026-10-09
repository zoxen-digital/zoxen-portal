import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { projectScope } from "@/lib/projects";
import { Activity } from "@/models/Activity";
import { Notification } from "@/models/Notification";
import { Project } from "@/models/Project";
import { Invoice } from "@/models/Invoice";
import { Meeting } from "@/models/Meeting";
import { Query } from "@/models/Query";
import { Client } from "@/models/Client";
import { Onboarding } from "@/models/Onboarding";
import { Ticket } from "@/models/Ticket";
import { Quote } from "@/models/Quote";
import { Contract } from "@/models/Contract";
import { RecurringPlan } from "@/models/RecurringPlan";
import { ticketScope } from "@/lib/tickets";
import { AuditLog } from "@/models/AuditLog";
import { LoginEvent } from "@/models/LoginEvent";
import { TrashItem } from "@/models/TrashItem";
import { Conversation } from "@/models/Conversation";
import { inboxScope } from "@/lib/inbox";
import type { Model } from "mongoose";

/** Time of the newest change in a collection the user can see (0 if none). */
async function latest(model: Model<unknown>, filter: Record<string, unknown> = {}, field = "updatedAt") {
  const doc = await model.findOne(filter).sort({ [field]: -1 }).select(field).lean<Record<string, Date | undefined>>();
  return doc?.[field] ? new Date(doc[field]!).getTime() : 0;
}

/**
 * A tiny "has anything changed?" stamp. Pages poll it and only re-render when it moves,
 * so updates appear without a manual refresh and without reloading whole pages every few seconds.
 */
export const GET = handle(async () => {
  const user = await apiUser(["agent", "super_admin", "team_admin", "client"]);
  await dbConnect();
  const me = new Types.ObjectId(user.id);
  const scope = projectScope(user);

  const parts: Promise<number>[] = [latest(Notification as Model<unknown>, { user: me }), latest(Project as Model<unknown>, scope)];
  // Chats: only new messages count (reading a chat must not trigger refreshes for everyone).
  if (user.role === "super_admin" || user.role === "team_admin") parts.push(latest(Conversation as Model<unknown>, await inboxScope(user), "lastMessageAt"));
  else if (user.role === "client") parts.push(latest(Conversation as Model<unknown>, { client: scope.client }, "lastMessageAt"));
  if (user.role === "agent") {
    for (const m of [Invoice, AuditLog, LoginEvent, TrashItem, Project, Ticket]) parts.push(latest(m as Model<unknown>, {}, m === AuditLog || m === LoginEvent ? "at" : m === TrashItem ? "deletedAt" : "updatedAt"));
  } else if (user.role === "super_admin") {
    for (const m of [Invoice, Meeting, Query, Client, Onboarding, Activity, Ticket, Quote, Contract, RecurringPlan]) parts.push(latest(m as Model<unknown>));
  } else if (user.role === "team_admin") {
    parts.push(
      latest(Query as Model<unknown>, { assignedTo: user.name }),
      latest(Ticket as Model<unknown>, await ticketScope(user)),
      latest(Onboarding as Model<unknown>)
    );
  } else {
    const client = { client: scope.client };
    parts.push(
      latest(Invoice as Model<unknown>, client),
      latest(Meeting as Model<unknown>, client),
      latest(Activity as Model<unknown>, { ...client, visibleToClient: true }),
      latest(Ticket as Model<unknown>, client),
      latest(Quote as Model<unknown>, { ...client, status: { $ne: "Draft" } }),
      latest(Contract as Model<unknown>, { ...client, status: { $in: ["Sent", "Signed"] } })
    );
  }
  const stamp = Math.max(...(await Promise.all(parts)));
  return json({ stamp }, 200, { "Cache-Control": "no-store" });
});
