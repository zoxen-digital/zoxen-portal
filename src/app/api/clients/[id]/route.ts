import { ADMIN, apiUser } from "@/lib/session";
import { dbConnect } from "@/lib/db";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Project } from "@/models/Project";
import { Activity } from "@/models/Activity";
import { Meeting } from "@/models/Meeting";
import { User } from "@/models/User";
import { Ticket } from "@/models/Ticket";
import { Message } from "@/models/Message";
import { RecurringPlan } from "@/models/RecurringPlan";
import { error, handle, json, pick, validId } from "@/lib/api";
import { CLIENT_FIELDS } from "@/lib/fields";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const client = await Client.findById(id).lean();
  return client ? json(client) : error("Client not found", 404);
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const data = pick(await req.json(), CLIENT_FIELDS);
  if ("name" in data && !data.name) return error("Client name is required");
  const client = await Client.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  return client ? json(client) : error("Client not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Promise.all([
    Query.deleteMany({ client: id }),
    Project.deleteMany({ client: id }),
    Activity.deleteMany({ client: id }),
    Meeting.deleteMany({ client: id }),
    Ticket.deleteMany({ client: id }),
    Message.deleteMany({ client: id }),
    // Stop billing a client that no longer exists.
    RecurringPlan.deleteMany({ client: id }),
    // Portal logins of a deleted client must stop working.
    User.deleteMany({ role: "client", client: id }),
  ]);
  await Client.findByIdAndDelete(id);
  return json({ ok: true });
});
