import { ADMIN, apiUser } from "@/lib/session";
import { notifyClient } from "@/lib/client-notify";
import { dbConnect } from "@/lib/db";
import { Client } from "@/models/Client";
import { error, handle, json, validId } from "@/lib/api";
import { followUpBody } from "@/lib/fields";

type Ctx = { params: Promise<{ id: string }> };

/** Custom follow-up from the client page. Body: { title, message, email } */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  if (!(await Client.exists({ _id: id }))) return error("Client not found", 404);
  const m = followUpBody(await req.json().catch(() => ({})));
  const via = await notifyClient(id, { ...m, link: "/portal", button: "Open portal" }, user);
  if (via === "none") return error("This client has no portal login, and no email could be sent. Invite them to the portal or add their email.");
  return json({ ok: true, via });
});
