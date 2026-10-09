import { HttpError, validId } from "./api";
import { CURRENCIES } from "./constants";
import { EXPENSE_CATEGORIES, EXPENSE_CYCLES } from "@/models/Expense";

/* eslint-disable @typescript-eslint/no-explicit-any */

function date(v: unknown) {
  if (v === null || v === "" || v === undefined) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new HttpError("Invalid date");
  return d;
}

/** Validates the expense form. */
export function expenseData(b: any) {
  const title = String(b?.title || "").trim().slice(0, 120);
  if (!title) throw new HttpError("Enter what the expense is for");
  const amount = Number(b?.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) throw new HttpError("Enter a valid amount");
  const cycle = EXPENSE_CYCLES.includes(b?.cycle) ? b.cycle : "Monthly";
  const client = typeof b?.client === "string" && validId(b.client) ? b.client : null;
  return {
    title,
    amount: Math.round(amount * 100) / 100,
    category: EXPENSE_CATEGORIES.includes(b?.category) ? b.category : "Other",
    vendor: String(b?.vendor || "").trim().slice(0, 80),
    currency: CURRENCIES.includes(b?.currency) ? b.currency : "PKR",
    cycle,
    date: date(b?.date) || new Date(),
    renewsOn: cycle === "One-time" ? null : date(b?.renewsOn),
    client,
    notes: String(b?.notes || "").slice(0, 1000),
    active: b?.active !== false,
  };
}

/** What one expense costs per month (subscriptions only; yearly spread over 12 months). */
export function monthlyCost(e: { cycle: string; amount: number; active?: boolean }) {
  if (e.active === false) return 0;
  if (e.cycle === "Monthly") return e.amount;
  if (e.cycle === "Yearly") return e.amount / 12;
  return 0;
}

/** Moves a passed renewal date forward to the next one (monthly or yearly). */
export function nextRenewal(from: Date, cycle: string) {
  const d = new Date(from);
  const now = Date.now();
  while (d.getTime() < now - 86_400_000) {
    if (cycle === "Yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
  }
  return d;
}
