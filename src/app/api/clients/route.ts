import { ADMIN, apiUser } from "@/lib/session";
import { dbConnect } from "@/lib/db";
import { Client } from "@/models/Client";
import { error, handle, json, pick } from "@/lib/api";
import { escapeRegex } from "@/lib/utils";
import { CLIENT_FIELDS } from "@/lib/fields";


export const GET = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const filter = q
    ? { $or: ["name", "company", "email", "phone"].map((f) => ({ [f]: { $regex: escapeRegex(q), $options: "i" } })) }
    : {};
  const clients = await Client.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return json(clients);
});

export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const body = await req.json();
  const data = pick(body, CLIENT_FIELDS);
  if (!data.name) return error("Client name is required");
  const client = await Client.create(data);
  return json(client, 201);
});
