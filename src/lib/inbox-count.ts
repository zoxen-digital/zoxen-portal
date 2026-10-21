import { dbConnect } from "./db";
import { inboxScope } from "./inbox";
import type { CurrentUser } from "./session";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

/**
 * Unread client messages for this staff member across all chats they can see (sidebar badge).
 * Stops counting at 10 because the badge shows "9+" from there.
 */
export async function unreadChats(user: CurrentUser) {
  if (user.role !== "super_admin" && user.role !== "team_admin") return 0;
  await dbConnect();
  const list = await Conversation.find({ ...(await inboxScope(user)), lastClientAt: { $ne: null } })
    .select(`client lastClientAt reads.${user.id}`)
    .sort({ lastClientAt: -1 })
    .lean<{ client: unknown; lastClientAt: Date; reads?: Record<string, Date> }[]>();
  let total = 0;
  for (const c of list) {
    const readAt = c.reads?.[user.id];
    if (readAt && new Date(c.lastClientAt) <= new Date(readAt)) continue;
    total += await Message.countDocuments({ client: c.client, ticket: null, authorRole: "client", ...(readAt ? { createdAt: { $gt: readAt } } : {}) });
    if (total >= 10) break;
  }
  return total;
}
