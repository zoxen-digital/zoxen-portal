import { dbConnect } from "@/lib/db";
import { Query } from "@/models/Query";
import { Client } from "@/models/Client";
import { error, handle, json, pick, validId } from "@/lib/api";
import { QUERY_FIELDS, cleanQuery } from "@/lib/fields";
import { ADMIN, STAFF, apiUser } from "@/lib/session";

export const GET = handle(async (req: Request) => {
  const user = await apiUser(STAFF);
  await dbConnect();
  const client = new URL(req.url).searchParams.get("client");
  const filter: Record<string, unknown> = client && validId(client) ? { client } : {};
  // Team members only see queries assigned to them, and never the amounts.
  if (user.role === "team_admin") filter.assignedTo = user.name;
  const queries = await Query.find(filter)
    .select(user.role === "team_admin" ? "-amount" : "")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  return json(queries);
});

export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const data = cleanQuery(pick(await req.json(), QUERY_FIELDS));
  if (!data.title) return error("Query title is required");
  if (!data.client || !validId(String(data.client))) return error("Please select a client");
  if (!(await Client.exists({ _id: data.client }))) return error("Client not found");
  const query = await Query.create(data);
  return json(query, 201);
});
