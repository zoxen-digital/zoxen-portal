import { dbConnect } from "@/lib/db";
import { HttpError, handle, json } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { sendChatMessage, toClientMessage } from "@/lib/inbox";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

function clientOf(user: { clientId?: string }) {
  if (!user.clientId) throw new HttpError("Your login is not linked to a client yet", 403);
  return user.clientId;
}

/** The client's single chat with the agency. Internal notes and team member names are never included. */
export const GET = handle(async () => {
  const user = await apiUser(["client"]);
  const clientId = clientOf(user);
  await dbConnect();
  const [list, { companyName }] = await Promise.all([
    Message.find({ client: clientId, ticket: null, internal: { $ne: true } }).sort({ createdAt: -1 }).limit(300).lean(),
    getSettings(),
  ]);
  await Conversation.updateOne({ client: clientId }, { $set: { clientReadAt: new Date() } });
  return json({ companyName, messages: list.reverse().map((m) => toClientMessage(m, companyName)) });
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser(["client"]);
  const clientId = clientOf(user);
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  // Clients can only send text and files; anything else in the body is ignored.
  const m = await sendChatMessage(user, clientId, { body: body.body, attachments: body.attachments });
  const { companyName } = await getSettings();
  return json(toClientMessage(m.toObject(), companyName), 201);
});
