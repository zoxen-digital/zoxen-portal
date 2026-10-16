import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { LeadList } from "@/models/LeadList";
import { Lead } from "@/models/Lead";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Sheet not found", 404);
  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  if (!name) return error("Give the sheet a name");
  await dbConnect();
  const list = await LeadList.findByIdAndUpdate(id, { $set: { name } }, { new: true });
  return list ? json(list) : error("Sheet not found", 404);
});

/** Deletes the sheet and its leads (both go to the recycle bin). */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Sheet not found", 404);
  await dbConnect();
  await Lead.deleteMany({ list: id });
  await LeadList.deleteOne({ _id: id });
  return json({ ok: true });
});
