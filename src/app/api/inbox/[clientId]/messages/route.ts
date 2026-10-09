import { handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { assertChatAccess, sendChatMessage } from "@/lib/inbox";

type Ctx = { params: Promise<{ clientId: string }> };

/** Team reply or internal note (with @mentions) in a client chat. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { clientId } = await params;
  await assertChatAccess(user, clientId);
  const m = await sendChatMessage(user, clientId, await req.json().catch(() => ({})));
  return json({ _id: String(m._id) }, 201);
});
