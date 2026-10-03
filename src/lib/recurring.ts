import { HttpError, validId } from "./api";
import { normalizeLines } from "./docs";
import { createInvoice } from "./fulfil";
import { RECURRING_INTERVALS } from "./constants";
import { RecurringPlan } from "@/models/RecurringPlan";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Same day next period. Day 29-31 lands on the last day of shorter months (e.g. Jan 31 -> Feb 28). */
export function advance(date: Date, interval: string) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + (MONTHS[interval] || 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export function planData(body: any) {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) throw new HttpError("Give this plan a name, e.g. Monthly SEO");
  const lines = normalizeLines(body);
  if (!lines.items.length) throw new HttpError("Add at least one line item");
  const interval = RECURRING_INTERVALS.includes(body.interval) ? body.interval : "monthly";
  const next = new Date(String(body.nextRunAt || ""));
  if (isNaN(next.getTime())) throw new HttpError("Choose the date of the next invoice");
  return {
    title,
    items: lines.items,
    discountType: lines.discountType,
    discountValue: lines.discountValue,
    taxPercent: lines.taxPercent,
    currency: lines.currency,
    interval,
    nextRunAt: next,
    dueDays: Math.max(0, Math.min(90, Math.round(Number(body.dueDays) || 7))),
    notes: typeof body.notes === "string" ? body.notes : "",
    terms: typeof body.terms === "string" ? body.terms : "",
    active: body.active !== false,
    ...(body.client && validId(String(body.client)) ? { client: body.client } : {}),
  };
}

/**
 * Creates this period's invoice for a plan and moves the schedule forward.
 * The plan is claimed atomically first, so two runs at the same moment can never bill twice.
 * If the plan fell behind (e.g. paused for months), it bills once and jumps to the next future date.
 */
export async function runPlan(plan: any, actor: { name: string; role: string }) {
  const now = new Date();
  let next = advance(plan.nextRunAt, plan.interval);
  while (next <= now) next = advance(next, plan.interval);

  const claimed = await RecurringPlan.findOneAndUpdate(
    { _id: plan._id, nextRunAt: plan.nextRunAt, active: true },
    { $set: { nextRunAt: next, lastRunAt: now }, $inc: { invoicesCreated: 1 } },
    { new: true }
  );
  if (!claimed) return null;

  const period = new Date(plan.nextRunAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const invoice = await createInvoice(
    {
      client: String(plan.client),
      items: plan.items,
      discountType: plan.discountType,
      discountValue: plan.discountValue,
      taxPercent: plan.taxPercent,
      currency: plan.currency,
      summary: `${plan.title} (${period})`,
      notes: plan.notes || undefined,
      terms: plan.terms || undefined,
      dueDays: plan.dueDays,
    },
    actor
  );
  await RecurringPlan.updateOne({ _id: plan._id }, { $set: { lastInvoice: invoice._id } });
  return invoice;
}

/** Every active plan whose date has come. Used by the daily job. */
export async function runDuePlans() {
  const due = await RecurringPlan.find({ active: true, nextRunAt: { $lte: new Date() } }).limit(200);
  let created = 0;
  for (const plan of due) {
    try {
      if (await runPlan(plan, { name: "Automatic billing", role: "system" })) created++;
    } catch (e) {
      console.error("Recurring plan failed:", String(plan._id), e);
    }
  }
  return created;
}
