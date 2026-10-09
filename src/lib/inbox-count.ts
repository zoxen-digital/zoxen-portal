import { dbConnect } from "./db";
import { inboxScope } from "./inbox";
import type { CurrentUser } from "./session";
import { Conversation } from "@/models/Conversation";

/** How many client chats have a client message this staff member has not opened yet (for the sidebar badge). */
export async function unreadChats(user: CurrentUser) {
  if (user.role !== "super_admin" && user.role !== "team_admin") return 0;
  await dbConnect();
  const list = await Conversation.find({ ...(await inboxScope(user)), lastClientAt: { $ne: null } })
    .select(`lastClientAt reads.${user.id}`)
    .lean<{ lastClientAt: Date; reads?: Record<string, Date> }[]>();
  return list.filter((c) => !c.reads?.[user.id] || new Date(c.lastClientAt) > new Date(c.reads[user.id]!)).length;
}
