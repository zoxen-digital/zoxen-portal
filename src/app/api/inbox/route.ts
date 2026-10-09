import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { backfillConversations, inboxScope, staffList } from "@/lib/inbox";
import { Conversation } from "@/models/Conversation";
import { Client } from "@/models/Client";
import { Message } from "@/models/Message";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The chat list: every client chat this staff member can see, newest first, with unread counts. */
export const GET = handle(async (req: Request) => {
  const user = await apiUser(STAFF);
  await dbConnect();
  await backfillConversations();
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") || "all";
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);

  const scope = await inboxScope(user);
  const and: Record<string, unknown>[] = [scope, { lastMessageAt: { $ne: null } }];
  if (filter === "mine") and.push({ assignedTo: new Types.ObjectId(user.id) });
  if (filter === "unassigned") and.push({ assignedTo: null });
  if (filter === "urgent") and.push({ priority: { $in: ["High", "Urgent"] } });
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const ids = await Client.find({ $or: [{ name: rx }, { company: rx }] }).distinct("_id");
    and.push({ client: { $in: ids } });
  }

  const list = await Conversation.find({ $and: and })
    .sort({ lastMessageAt: -1 })
    .limit(300)
    .populate("client", "name company")
    .populate("assignedTo", "name")
    .populate("project", "title")
    .lean<any[]>();

  const rows = await Promise.all(
    list.map(async (c) => {
      const readAt = c.reads?.[user.id] ? new Date(c.reads[user.id]) : null;
      const unreadSince = c.lastClientAt && (!readAt || new Date(c.lastClientAt) > readAt);
      const unread = unreadSince
        ? await Message.countDocuments({ client: c.client?._id, ticket: null, authorRole: "client", ...(readAt ? { createdAt: { $gt: readAt } } : {}) })
        : 0;
      return {
        client: String(c.client?._id || ""),
        name: c.client?.company || c.client?.name || "Deleted client",
        contact: c.client?.company ? c.client?.name : "",
        assignedTo: c.assignedTo ? { _id: String(c.assignedTo._id), name: c.assignedTo.name } : null,
        priority: c.priority,
        project: c.project?.title || "",
        lastMessageAt: c.lastMessageAt,
        lastPreview: c.lastPreview,
        lastAuthorName: c.lastAuthorName,
        lastAuthorRole: c.lastAuthorRole,
        lastRepliedBy: c.lastRepliedBy,
        waiting: !!(c.lastClientAt && (!c.lastTeamAt || new Date(c.lastClientAt) > new Date(c.lastTeamAt))),
        unread,
      };
    })
  );
  const out = (filter === "unread" ? rows.filter((r) => r.unread > 0) : rows).filter((r) => r.client);
  return json({ rows: out, staff: await staffList() });
});
