import { dbConnect } from "@/lib/db";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { error, handle, json, pick, validId } from "@/lib/api";
import { CLIENT_FIELDS } from "@/lib/fields";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const client = await Client.findById(id).lean();
  return client ? json(client) : error("Client not found", 404);
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const data = pick(await req.json(), CLIENT_FIELDS);
  if ("name" in data && !data.name) return error("Client name is required");
  const client = await Client.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  return client ? json(client) : error("Client not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Query.deleteMany({ client: id });
  await Client.findByIdAndDelete(id);
  return json({ ok: true });
});
