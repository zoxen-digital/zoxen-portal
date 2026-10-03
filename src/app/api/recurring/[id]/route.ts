import { dbConnect } from "@/lib/db";
import { RecurringPlan } from "@/models/RecurringPlan";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { planData } from "@/lib/recurring";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Plan not found", 404);
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  // Quick pause / resume from the list: { active }
  const data =
    Object.keys(body).length === 1 && "active" in body
      ? { active: body.active === true || body.active === "Active" }
      : (({ client: _c, ...rest }) => rest)(planData(body) as Record<string, unknown>);
  const plan = await RecurringPlan.findByIdAndUpdate(id, data, { new: true }).lean();
  return plan ? json(plan) : error("Plan not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Plan not found", 404);
  await dbConnect();
  await RecurringPlan.findByIdAndDelete(id);
  return json({ ok: true });
});
