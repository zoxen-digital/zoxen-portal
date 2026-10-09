import { dbConnect } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { expenseData } from "@/lib/expenses";
import { Expense } from "@/models/Expense";

export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  return json(await Expense.find().sort({ date: -1 }).lean());
});

export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const e = await Expense.create(expenseData(await req.json().catch(() => ({}))));
  return json(e, 201);
});
