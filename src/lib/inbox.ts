import { Types } from "mongoose";
import { HttpError, validId } from "./api";
import { dbConnect } from "./db";
import { cleanAttachments } from "./docs";
import { clientUserIds, notify, superAdminIds } from "./notify";
import { getSettings } from "./settings";
import type { CurrentUser } from "./session";
import { CHAT_PRIORITIES, Conversation } from "@/models/Conversation";
import { Client } from "@/models/Client";
import { Message } from "@/models/Message";
import { Project } from "@/models/Project";
import { User } from "@/models/User";

/* eslint-disable @typescript-eslint/no-explicit-any */

const oid = (id: string) => new Types.ObjectId(id);

/** What a client may see of a message: no team member names, ids, mentions or internal fields. */
export function toClientMessage(m: any, companyName: string) {
  const team = m.authorRole !== "client";
  return {
    _id: String(m._id),
    project: m.project ? String(m.project) : undefined,
    ticket: m.ticket ? String(m.ticket) : undefined,
    authorName: team ? companyName : m.authorName,
    authorRole: team ? "team_admin" : "client",
    body: m.body,
    attachments: m.attachments || [],
    createdAt: m.createdAt,
  };
}

/** Clients whose chats a team member may open: projects they are on, chats assigned to them, or where they were @mentioned. */
async function teamClientIds(user: CurrentUser) {
  const me = oid(user.id);
  const [fromProjects, fromChats] = await Promise.all([
    Project.distinct("client", { team: me }),
    Conversation.distinct("client", { $or: [{ assignedTo: me }, { participants: me }] }),
  ]);
  return [...fromProjects, ...fromChats] as Types.ObjectId[];
}

/** Mongo filter on Conversation for the chats this staff member can see. */
export async function inboxScope(user: CurrentUser): Promise<Record<string, unknown>> {
  if (user.role === "super_admin") return {};
  if (user.role === "team_admin") return { client: { $in: await teamClientIds(user) } };
  throw new HttpError("You do not have access to this", 403);
}

/** Throws 404 unless this staff member may open the client's chat. */
export async function assertChatAccess(user: CurrentUser, clientId: string) {
  if (!validId(clientId)) throw new HttpError("Chat not found", 404);
  await dbConnect();
  if (user.role === "super_admin") {
    if (!(await Client.exists({ _id: clientId }))) throw new HttpError("Chat not found", 404);
    return;
  }
  const ids = user.role === "team_admin" ? await teamClientIds(user) : [];
  if (!ids.some((i) => String(i) === clientId)) throw new HttpError("Chat not found", 404);
}

/** The client's chat, created on first use. */
export async function conversationOf(clientId: string) {
  return Conversation.findOneAndUpdate({ client: clientId }, { $setOnInsert: { client: clientId } }, { upsert: true, new: true });
}

/** Chats from before the inbox existed: create a conversation for every client that already has project messages. */
let backfilled = false;
export async function backfillConversations() {
  if (backfilled) return;
  backfilled = true;
  const groups = await Message.aggregate([
    { $match: { ticket: null, client: { $ne: null } } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: "$client",
        lastAt: { $last: "$createdAt" },
        body: { $last: "$body" },
        name: { $last: "$authorName" },
        role: { $last: "$authorRole" },
        lastClientAt: { $max: { $cond: [{ $eq: ["$authorRole", "client"] }, "$createdAt", null] } },
        lastTeamAt: { $max: { $cond: [{ $ne: ["$authorRole", "client"] }, "$createdAt", null] } },
      },
    },
  ]);
  for (const g of groups) {
    await Conversation.updateOne(
      { client: g._id },
      {
        $setOnInsert: {
          client: g._id,
          lastMessageAt: g.lastAt,
          lastPreview: String(g.body || "Sent a file").slice(0, 120),
          lastAuthorName: g.name || "",
          lastAuthorRole: g.role || "",
          lastClientAt: g.lastClientAt,
          lastTeamAt: g.lastTeamAt,
        },
      },
      { upsert: true }
    );
  }
}

/** Active staff, for the assign menu and @mentions. */
export async function staffList() {
  return User.find({ role: { $in: ["super_admin", "team_admin"] }, status: "active" })
    .select("name title role")
    .sort({ name: 1 })
    .lean<{ _id: unknown; name: string; title?: string; role: string }[]>()
    .then((us) => us.map((u) => ({ _id: String(u._id), name: u.name, title: u.title || "", role: u.role })));
}

/** Keeps the chat list row (last message, unread markers) in step with a new message. */
export async function touchConversation(clientId: string, m: { body?: string; attachments?: unknown[]; authorName: string; authorRole: string; internal?: boolean; at: Date }) {
  const preview = (m.body || (m.attachments?.length ? "Sent a file" : "")).slice(0, 120);
  const set: Record<string, unknown> = { lastMessageAt: m.at, lastPreview: (m.internal ? "Note: " : "") + preview, lastAuthorName: m.authorName, lastAuthorRole: m.authorRole };
  if (m.authorRole === "client") set.lastClientAt = m.at;
  else if (!m.internal) {
    set.lastTeamAt = m.at;
    set.lastRepliedBy = m.authorName;
  }
  await Conversation.updateOne({ client: clientId }, { $set: set, $setOnInsert: { client: clientId } }, { upsert: true });
}

/** Everyone on the team who should hear about a client message: the assignee, or (unassigned) owners + the client's project teams. */
async function teamToAlert(clientId: string, conv: any) {
  if (conv?.assignedTo) return [String(conv.assignedTo)];
  const teams = await Project.find({ client: clientId, stage: { $nin: ["Completed", "Cancelled"] } }).select("team").lean<{ team?: unknown[] }[]>();
  return [...new Set([...(await superAdminIds()), ...teams.flatMap((p) => (p.team || []).map(String))])];
}

const EMAIL_GAP_MS = 30 * 60 * 1000;

/** Sends a message in the client's inbox chat, from the client or a team member. */
export async function sendChatMessage(
  user: CurrentUser,
  clientId: string,
  input: { body?: unknown; attachments?: unknown; internal?: unknown; mentions?: unknown; project?: unknown }
) {
  const isClient = user.role === "client";
  const body = typeof input.body === "string" ? input.body.trim().slice(0, 5000) : "";
  const attachments = cleanAttachments(input.attachments);
  if (!body && !attachments.length) throw new HttpError("Write a message or attach a file");

  const internal = !isClient && input.internal === true;
  let mentions: string[] = [];
  if (!isClient && Array.isArray(input.mentions)) {
    const asked = input.mentions.filter((x): x is string => typeof x === "string" && validId(x)).slice(0, 20);
    const ok = await User.find({ _id: { $in: asked }, role: { $in: ["super_admin", "team_admin"] }, status: "active" }).select("_id").lean();
    mentions = ok.map((u) => String(u._id)).filter((id) => id !== user.id);
  }
  let project: string | null = null;
  if (!isClient && typeof input.project === "string" && validId(input.project)) {
    if (await Project.exists({ _id: input.project, client: clientId })) project = input.project;
  }

  const conv = await conversationOf(clientId);
  const previousTeam = conv.lastTeamAt as Date | null;
  const message = await Message.create({
    client: clientId,
    project,
    author: user.id,
    authorName: user.name,
    authorRole: user.role,
    body,
    attachments,
    internal,
    mentions,
  });
  await touchConversation(clientId, { body, attachments, authorName: user.name, authorRole: user.role, internal, at: message.createdAt });
  // Writing counts as reading.
  if (isClient) await Conversation.updateOne({ _id: conv._id }, { $set: { clientReadAt: new Date() } });
  else await Conversation.updateOne({ _id: conv._id }, { $set: { [`reads.${user.id}`]: new Date() }, ...(mentions.length ? { $addToSet: { participants: { $each: mentions.map(oid) } } } : {}) });
  if (project) await Project.updateOne({ _id: project }, { $set: { lastMessageAt: new Date() } });

  const client = await Client.findById(clientId).select("name company").lean<{ name: string; company?: string }>();
  const clientLabel = client?.company || client?.name || "Client";
  const preview = body ? body.slice(0, 140) : `${attachments.length} file${attachments.length > 1 ? "s" : ""} attached`;

  if (isClient) {
    await notify(await teamToAlert(clientId, conv), { title: `${clientLabel}: new message`, body: preview, link: `/inbox?c=${clientId}` });
  } else {
    if (mentions.length) {
      await notify(mentions, { title: `${user.name} mentioned you in ${clientLabel} chat`, body: preview, link: `/inbox?c=${clientId}`, email: { button: "Open chat" } });
    }
    if (!internal) {
      const { companyName } = await getSettings();
      const quiet = previousTeam && Date.now() - new Date(previousTeam).getTime() < EMAIL_GAP_MS;
      await notify(await clientUserIds(clientId), {
        title: `New message from ${companyName}`,
        body: preview,
        link: "/portal/chat",
        email: quiet ? undefined : { button: "Reply" },
      });
    }
  }
  return message;
}

/** Assignment, priority and default project. Team only. */
export async function updateConversation(user: CurrentUser, clientId: string, input: { assignedTo?: unknown; priority?: unknown; project?: unknown }) {
  const set: Record<string, unknown> = {};
  if (input.assignedTo !== undefined) {
    if (input.assignedTo === null || input.assignedTo === "") set.assignedTo = null;
    else {
      if (typeof input.assignedTo !== "string" || !validId(input.assignedTo)) throw new HttpError("Pick a team member");
      const u = await User.findOne({ _id: input.assignedTo, role: { $in: ["super_admin", "team_admin"] }, status: "active" }).select("name").lean<{ name: string }>();
      if (!u) throw new HttpError("Pick a team member");
      set.assignedTo = oid(input.assignedTo);
    }
  }
  if (input.priority !== undefined) {
    if (!CHAT_PRIORITIES.includes(input.priority as (typeof CHAT_PRIORITIES)[number])) throw new HttpError("Unknown priority");
    set.priority = input.priority;
  }
  if (input.project !== undefined) {
    if (input.project === null || input.project === "") set.project = null;
    else {
      if (typeof input.project !== "string" || !validId(input.project) || !(await Project.exists({ _id: input.project, client: clientId }))) throw new HttpError("Pick one of this client's projects");
      set.project = oid(input.project);
    }
  }
  const before = await conversationOf(clientId);
  const conv = await Conversation.findOneAndUpdate({ _id: before._id }, { $set: set }, { new: true });
  if (set.assignedTo && String(before.assignedTo || "") !== String(set.assignedTo) && String(set.assignedTo) !== user.id) {
    const client = await Client.findById(clientId).select("name company").lean<{ name: string; company?: string }>();
    await notify([String(set.assignedTo)], { title: `${user.name} assigned you the ${client?.company || client?.name || "client"} chat`, link: `/inbox?c=${clientId}` });
  }
  return conv;
}
