import { dbConnect } from "@/lib/db";
import { Query } from "@/models/Query";
import { error, handle, json, pick, validId } from "@/lib/api";
import { QUERY_FIELDS, cleanQuery } from "@/lib/fields";
import { ADMIN, STAFF, apiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const isTeam = user.role === "team_admin";
  // Team members can move their own queries along and add notes, nothing else.
  const data = cleanQuery(pick(await req.json(), isTeam ? ["status", "notes"] : QUERY_FIELDS));
  if ("title" in data && !data.title) return error("Query title is required");
  if ("client" in data) {
    if (data.client === "" || data.client === null) {
      // Only website leads may stay without a client.
      const cur = await Query.findById(id).select("lead.name").lean<{ lead?: { name?: string } }>();
      if (!cur?.lead?.name) return error("Please select a client");
      data.client = null;
    } else if (!validId(String(data.client))) return error("Please select a client");
  }
  const filter = isTeam ? { _id: id, assignedTo: user.name } : { _id: id };
  const query = await Query.findOneAndUpdate(filter, data, { new: true, runValidators: true })
    .select(isTeam ? "-amount" : "")
    .lean();
  return query ? json(query) : error("Query not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Query.findByIdAndDelete(id);
  return json({ ok: true });
});
