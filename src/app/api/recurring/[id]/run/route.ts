import { dbConnect } from "@/lib/db";
import { RecurringPlan } from "@/models/RecurringPlan";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { runPlan } from "@/lib/recurring";

type Ctx = { params: Promise<{ id: string }> };

/** Bills the upcoming period now (instead of waiting for its date); the schedule moves forward. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Plan not found", 404);
  await dbConnect();
  const plan = await RecurringPlan.findById(id);
  if (!plan) return error("Plan not found", 404);
  if (!plan.active) return error("Resume the plan first");
  const invoice = await runPlan(plan, user);
  if (!invoice) return error("This period was just billed. Refresh the page.");
  return json({ invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber });
});
