import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { FINDER_STATUSES, FinderLead } from "@/models/FinderLead";

type Ctx = { params: Promise<{ id: string }> };

/** Tick (done) / cross (not interested) / back to new. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Not found", 404);
  const { status } = await req.json().catch(() => ({}));
  if (!(FINDER_STATUSES as readonly string[]).includes(status)) return error("Unknown status");
  await dbConnect();
  const lead = await FinderLead.findByIdAndUpdate(id, { $set: { status, statusBy: status === "new" ? "" : user.name, statusAt: status === "new" ? null : new Date() } }, { new: true }).lean();
  return lead ? json(lead) : error("Not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Not found", 404);
  await dbConnect();
  await FinderLead.deleteOne({ _id: id });
  return json({ ok: true });
});
