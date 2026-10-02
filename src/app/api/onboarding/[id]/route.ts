import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";
import { error, handle, json, validId } from "@/lib/api";
import { ONBOARDING_STATUSES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  const { status } = await req.json();
  if (!(ONBOARDING_STATUSES as readonly string[]).includes(status)) return error("Invalid status");
  await dbConnect();
  const doc = await Onboarding.findByIdAndUpdate(id, { status }, { new: true }).lean();
  return doc ? json(doc) : error("Submission not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Onboarding.findByIdAndDelete(id);
  return json({ ok: true });
});
