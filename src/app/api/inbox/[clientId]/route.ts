import { dbConnect } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { assertChatAccess, conversationOf, updateConversation } from "@/lib/inbox";
import { Client } from "@/models/Client";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { Project } from "@/models/Project";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Ctx = { params: Promise<{ clientId: string }> };

/** One client chat for the team: details, projects and the latest 300 messages (internal notes included). Marks it read. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { clientId } = await params;
  await assertChatAccess(user, clientId);
  await dbConnect();
  const conv = await conversationOf(clientId);
  await Conversation.updateOne({ _id: conv._id }, { $set: { [`reads.${user.id}`]: new Date() } });
  const [client, projects, messages] = await Promise.all([
    Client.findById(clientId).select("name company email phone").lean<any>(),
    Project.find({ client: clientId }).select("title stage").sort({ updatedAt: -1 }).lean<any[]>(),
    Message.find({ client: clientId, ticket: null }).sort({ createdAt: -1 }).limit(300).populate("project", "title").lean<any[]>(),
  ]);
  return json({
    client: { _id: clientId, name: client?.company || client?.name || "Client", contact: client?.company ? client?.name : "", email: client?.email || "", phone: client?.phone || "" },
    conversation: {
      assignedTo: conv.assignedTo ? String(conv.assignedTo) : null,
      priority: conv.priority,
      project: conv.project ? String(conv.project) : null,
      lastRepliedBy: conv.lastRepliedBy,
      clientReadAt: conv.clientReadAt,
    },
    projects: projects.map((p) => ({ _id: String(p._id), title: p.title, stage: p.stage })),
    messages: messages.reverse().map((m) => ({
      _id: String(m._id),
      authorName: m.authorName,
      authorRole: m.authorRole,
      body: m.body,
      attachments: m.attachments || [],
      internal: !!m.internal,
      project: m.project ? { _id: String(m.project._id), title: m.project.title } : null,
      createdAt: m.createdAt,
    })),
  });
});

/** Assign, set priority or default project. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { clientId } = await params;
  await assertChatAccess(user, clientId);
  const conv = await updateConversation(user, clientId, await req.json().catch(() => ({})));
  return json({ assignedTo: conv.assignedTo ? String(conv.assignedTo) : null, priority: conv.priority, project: conv.project ? String(conv.project) : null });
});
