import { dbConnect } from "@/lib/db";
import { RecurringPlan } from "@/models/RecurringPlan";
import { Client } from "@/models/Client";
import { error, handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { planData } from "@/lib/recurring";

export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  return json(await RecurringPlan.find().sort({ active: -1, nextRunAt: 1 }).populate("client", "name company").lean());
});

export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const data = planData(await req.json().catch(() => ({})));
  if (!("client" in data) || !(await Client.exists({ _id: data.client }))) return error("Choose a client");
  return json(await RecurringPlan.create(data), 201);
});
