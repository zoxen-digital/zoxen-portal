import { dbConnect } from "@/lib/db";
import { error, handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { LeadList } from "@/models/LeadList";

export const GET = handle(async () => {
  await apiUser(STAFF);
  await dbConnect();
  return json(await LeadList.find().sort({ createdAt: -1 }).lean());
});

/** Creates an empty sheet; rows are sent next in batches to /rows. */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(STAFF);
  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  if (!name) return error("Give the sheet a name");
  await dbConnect();
  const list = await LeadList.create({
    name,
    source: typeof b.source === "string" && b.source.trim() ? b.source.trim().slice(0, 40) : "LinkedIn",
    createdBy: user.id,
    createdByName: user.name,
  });
  return json(list, 201);
});
