import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { expenseData } from "@/lib/expenses";
import { Expense } from "@/models/Expense";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Expense not found", 404);
  await dbConnect();
  const data = expenseData(await req.json().catch(() => ({})));
  // A new renewal date means a new reminder.
  const e = await Expense.findByIdAndUpdate(id, { $set: { ...data, reminderFor: null } }, { new: true });
  if (!e) return error("Expense not found", 404);
  return json(e);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Expense not found", 404);
  await dbConnect();
  await Expense.deleteOne({ _id: id });
  return json({ ok: true });
});
