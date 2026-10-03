import type { Model } from "mongoose";
import { HttpError } from "./api";
import { calcTotals } from "./invoice-calc";
import { normalizeInvoiceBody } from "./invoices";
import { escapeRegex } from "./utils";
import type { AttachmentT } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Next "PREFIX-2026-001" style number for any collection with a unique number field. */
export async function nextNumber(model: Model<any>, prefix: string, field = "number", withYear = true) {
  const base = withYear ? `${prefix}-${new Date().getFullYear()}-` : `${prefix}-`;
  const last = await model
    .findOne({ [field]: { $regex: `^${escapeRegex(base)}\\d+$` } })
    .sort({ createdAt: -1 })
    .select(field)
    .lean<Record<string, string>>();
  let seq = last ? parseInt(String(last[field]).slice(base.length), 10) || 0 : 0;
  let candidate: string;
  do {
    seq++;
    candidate = `${base}${String(seq).padStart(3, "0")}`;
  } while (await model.exists({ [field]: candidate }));
  return candidate;
}

/** Line items + pricing fields shared by quotes, recurring plans and packages. */
export function normalizeLines(body: any) {
  const n = normalizeInvoiceBody(body);
  return {
    items: n.items,
    extraCosts: n.extraCosts,
    discountType: n.discountType,
    discountValue: Math.max(0, n.discountValue),
    taxPercent: Math.max(0, n.taxPercent),
    currency: n.currency,
  };
}

/** Totals without payments (quotes are not paid; they become invoices). */
export function lineTotals(d: ReturnType<typeof normalizeLines>) {
  const { paid: _paid, balance: _balance, ...t } = calcTotals({ ...d, paid: 0 });
  return t;
}

const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

/** Only files uploaded through our own storage are accepted as attachments. */
export function cleanAttachments(input: unknown): AttachmentT[] {
  if (!Array.isArray(input)) return [];
  if (input.length > 10) throw new HttpError("You can attach up to 10 files at once");
  return input.map((a: any) => {
    const url = String(a?.url || "");
    if (!BLOB_HOST.test(url)) throw new HttpError("Invalid attachment");
    return {
      name: String(a?.name || "file").replace(/[\r\n]/g, " ").slice(0, 200),
      url,
      size: Number(a?.size) || undefined,
      contentType: String(a?.contentType || "").slice(0, 100) || undefined,
    };
  });
}

/** Best guess of the caller's IP, for signature records. */
export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86_400_000);
}
