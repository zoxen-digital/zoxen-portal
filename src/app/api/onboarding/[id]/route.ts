import { ADMIN, STAFF, apiUser } from "@/lib/session";
import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";
import { error, handle, json, validId } from "@/lib/api";
import { referralNotConverted, referralReopened } from "@/lib/referrals";
import { Referral } from "@/models/Referral";

type Ctx = { params: Promise<{ id: string }> };

/** Mark as Reviewed / Rejected / back to New. Approving goes through /approve (it creates the project). */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  const { status } = await req.json();
  if (!["New", "Reviewed", "Rejected"].includes(status)) return error("Use Approve to approve a form");
  await dbConnect();
  const doc = await Onboarding.findOneAndUpdate({ _id: id, status: { $nin: ["Approved", "Converted"] } }, { status }, { new: true }).lean();
  if (doc) await (status === "Rejected" ? referralNotConverted(id) : referralReopened(id));
  return doc ? json(doc) : error("Approved forms cannot change status", 400);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Onboarding.findByIdAndDelete(id);
  await Referral.deleteOne({ onboarding: id });
  return json({ ok: true });
});
