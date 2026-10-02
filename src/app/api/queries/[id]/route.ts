import { dbConnect } from "@/lib/db";
import { Query } from "@/models/Query";
import { error, handle, json, pick, validId } from "@/lib/api";
import { QUERY_FIELDS, cleanQuery } from "@/lib/fields";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const data = cleanQuery(pick(await req.json(), QUERY_FIELDS));
  if ("title" in data && !data.title) return error("Query title is required");
  if ("client" in data && !validId(String(data.client))) return error("Please select a client");
  const query = await Query.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  return query ? json(query) : error("Query not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Query.findByIdAndDelete(id);
  return json({ ok: true });
});
