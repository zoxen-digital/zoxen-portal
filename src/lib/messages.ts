import { HttpError } from "./api";
import { getSettings } from "./settings";
import { toClientMessage, touchConversation } from "./inbox";
import { cleanAttachments } from "./docs";
import { clientUserIds, notify, superAdminIds } from "./notify";
import type { CurrentUser } from "./session";
import { Message } from "@/models/Message";
import { Project } from "@/models/Project";
import { Ticket } from "@/models/Ticket";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Messages on a project or ticket. Clients never get internal notes, and see the team as the company name. */
export async function listMessages(filter: { project?: string; ticket?: string }, forClient = false) {
  const list = await Message.find({ ...filter, ...(forClient ? { internal: { $ne: true } } : {}) }).sort({ createdAt: 1 }).limit(500).lean<any[]>();
  if (!forClient) return list;
  const { companyName } = await getSettings();
  return list.map((m) => toClientMessage(m, companyName));
}

// Clients get an email for a team reply, but not for every message in a quick back-and-forth.
const EMAIL_GAP_MS = 30 * 60 * 1000;

/**
 * Saves a chat message on a project or ticket and tells the other side:
 * client -> the project team / ticket assignee + owners; team -> the client's portal logins.
 */
export async function postMessage(
  thread: { kind: "project"; doc: any } | { kind: "ticket"; doc: any },
  user: CurrentUser,
  input: { body?: unknown; attachments?: unknown }
) {
  const body = typeof input.body === "string" ? input.body.trim().slice(0, 5000) : "";
  const attachments = cleanAttachments(input.attachments);
  if (!body && !attachments.length) throw new HttpError("Write a message or attach a file");

  const doc = thread.doc;
  const ref = thread.kind === "project" ? { project: doc._id } : { ticket: doc._id };
  const previous = await Message.findOne({ ...ref, authorRole: user.role === "client" ? "client" : { $ne: "client" } })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean<{ createdAt: Date }>();

  const message = await Message.create({
    ...ref,
    client: doc.client,
    author: user.id,
    authorName: user.name,
    authorRole: user.role,
    body,
    attachments,
  });

  // Touch the parent so live updates and "latest activity" sorting pick it up.
  if (thread.kind === "project") {
    await Project.updateOne({ _id: doc._id }, { $set: { lastMessageAt: new Date() } });
    // Project chat is part of the client inbox chat too.
    await touchConversation(String(doc.client), { body, attachments, authorName: user.name, authorRole: user.role, at: message.createdAt });
  }
  else {
    // A client reply on a ticket that was waiting on them (or marked resolved) puts it back in the team's queue.
    const reopen = user.role === "client" && ["Waiting on Client", "Resolved"].includes(doc.status);
    await Ticket.updateOne({ _id: doc._id }, { $set: { updatedAt: new Date(), ...(reopen ? { status: "Open", resolvedAt: null } : {}) } });
    if (reopen) doc.status = "Open";
  }

  const label = thread.kind === "project" ? doc.title : `${doc.number}: ${doc.title}`;
  const preview = body ? body.slice(0, 140) : `${attachments.length} file${attachments.length > 1 ? "s" : ""} attached`;

  if (user.role === "client") {
    const staff =
      thread.kind === "project"
        ? [...(doc.team || []).map(String), ...(await superAdminIds())]
        : [...(doc.assignee ? [String(doc.assignee)] : []), ...(await superAdminIds())];
    await notify(
      [...new Set(staff)],
      {
        title: `${user.name} on ${label}`,
        body: preview,
        link: thread.kind === "project" ? `/projects/${doc._id}#chat` : `/tickets/${doc._id}`,
        history: thread.kind !== "project",
      }
    );
  } else {
    const quiet = previous && Date.now() - new Date(previous.createdAt).getTime() < EMAIL_GAP_MS;
    await notify(await clientUserIds(String(doc.client)), {
      title: `New message on ${label}`,
      body: `${user.name}: ${preview}`,
      link: thread.kind === "project" ? `/portal/projects/${doc._id}#chat` : `/portal/tickets/${doc._id}`,
      email: quiet ? undefined : { button: "Reply" },
      history: thread.kind !== "project",
    });
  }
  return message;
}
