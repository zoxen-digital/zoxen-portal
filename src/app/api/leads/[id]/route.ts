import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { LEAD_STATUSES, Lead } from "@/models/Lead";

type Ctx = { params: Promise<{ id: string }> };

/** Tick "messaged", change status, set a follow-up date or notes. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Lead not found", 404);
  const b = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = { updatedBy: user.name };
  if (typeof b.messaged === "boolean") {
    set.messaged = b.messaged;
    set.messagedAt = b.messaged ? new Date() : null;
    set.messagedBy = b.messaged ? user.name : "";
  }
  if (b.status !== undefined) {
    if (!LEAD_STATUSES.includes(b.status)) return error("Unknown status");
    set.status = b.status;
    // Any answer means they were messaged.
    if (b.status !== "Pending") set.messaged = true;
  }
  if (b.followUpAt !== undefined) {
    const d = b.followUpAt ? new Date(String(b.followUpAt)) : null;
    if (d && Number.isNaN(d.getTime())) return error("Invalid date");
    set.followUpAt = d;
    set.followUpNotified = null;
  }
  if (typeof b.notes === "string") set.notes = b.notes.slice(0, 2000);
  await dbConnect();
  const lead = await Lead.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  return lead ? json(lead) : error("Lead not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Lead not found", 404);
  await dbConnect();
  await Lead.deleteOne({ _id: id });
  return json({ ok: true });
});
