import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { ticketFor } from "@/lib/tickets";
import { listMessages, postMessage } from "@/lib/messages";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(["client"]);
  const { id } = await params;
  const ticket = await ticketFor(user, id);
  return json(await listMessages({ ticket: String(ticket._id) }));
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(["client"]);
  const { id } = await params;
  const ticket = await ticketFor(user, id);
  return json(await postMessage({ kind: "ticket", doc: ticket }, user, await req.json().catch(() => ({}))), 201);
});
