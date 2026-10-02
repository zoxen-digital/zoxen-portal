import { dbConnect } from "@/lib/db";
import { Query } from "@/models/Query";
import { Client } from "@/models/Client";
import { error, handle, json, pick, validId } from "@/lib/api";
import { QUERY_FIELDS, cleanQuery } from "@/lib/fields";

export const GET = handle(async (req: Request) => {
  await dbConnect();
  const client = new URL(req.url).searchParams.get("client");
  const filter = client && validId(client) ? { client } : {};
  const queries = await Query.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return json(queries);
});

export const POST = handle(async (req: Request) => {
  await dbConnect();
  const data = cleanQuery(pick(await req.json(), QUERY_FIELDS));
  if (!data.title) return error("Query title is required");
  if (!data.client || !validId(String(data.client))) return error("Please select a client");
  if (!(await Client.exists({ _id: data.client }))) return error("Client not found");
  const query = await Query.create(data);
  return json(query, 201);
});
