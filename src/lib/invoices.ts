import { randomBytes } from "crypto";
import { Invoice } from "@/models/Invoice";
import { calcTotals, deriveStatus } from "./invoice-calc";
import { escapeRegex } from "./utils";
import type { ExtraCost, InvoiceItem, Payment } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function newPublicId() {
  return randomBytes(12).toString("base64url");
}

export async function nextInvoiceNumber(prefix: string) {
  const year = new Date().getFullYear();
  const base = `${prefix || "INV"}-${year}-`;
  const last = await Invoice.findOne({ invoiceNumber: { $regex: `^${escapeRegex(base)}` } })
    .sort({ createdAt: -1 })
    .select("invoiceNumber")
    .lean<{ invoiceNumber: string }>();
  const lastSeq = last ? parseInt(last.invoiceNumber.slice(base.length), 10) || 0 : 0;
  let seq = lastSeq + 1;
  // Guard against gaps/duplicates.
  while (await Invoice.exists({ invoiceNumber: `${base}${String(seq).padStart(3, "0")}` })) seq++;
  return `${base}${String(seq).padStart(3, "0")}`;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Cleans the form payload into fields safe to store on an invoice. */
export function normalizeInvoiceBody(body: any) {
  const items: InvoiceItem[] = (Array.isArray(body.items) ? body.items : [])
    .filter((i: any) => String(i?.description || "").trim())
    .map((i: any) => ({
      description: String(i.description).trim(),
      details: String(i.details || "").trim(),
      qty: num(i.qty),
      unit: String(i.unit || "").trim(),
      rate: num(i.rate),
    }));

  const extraCosts: ExtraCost[] = (Array.isArray(body.extraCosts) ? body.extraCosts : [])
    .filter((e: any) => String(e?.label || "").trim())
    .map((e: any) => ({ label: String(e.label).trim(), amount: num(e.amount) }));

  const tags = Array.isArray(body.requirement?.tags)
    ? body.requirement.tags
    : String(body.requirement?.tags || "")
        .split(",")
        .map((t: string) => t.trim());

  const pd = body.paymentDetails || {};

  return {
    items,
    extraCosts,
    requirement: {
      summary: String(body.requirement?.summary || "").trim(),
      websites: num(body.requirement?.websites),
      pages: num(body.requirement?.pages),
      tags: tags.filter(Boolean),
    },
    discountType: (body.discountType === "percent" ? "percent" : "fixed") as "fixed" | "percent",
    discountValue: num(body.discountValue),
    discountLabel: String(body.discountLabel || "").trim(),
    taxPercent: num(body.taxPercent),
    currency: String(body.currency || "PKR"),
    issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    notes: String(body.notes || ""),
    terms: String(body.terms || ""),
    paymentDetails: {
      bankName: String(pd.bankName || "").trim(),
      accountName: String(pd.accountName || "").trim(),
      accountNumber: String(pd.accountNumber || "").trim(),
      iban: String(pd.iban || "").trim(),
      other: String(pd.other || "").trim(),
    },
  };
}

export function recompute(doc: {
  items: InvoiceItem[];
  extraCosts: ExtraCost[];
  discountType: "fixed" | "percent";
  discountValue: number;
  taxPercent: number;
  payments: Pick<Payment, "amount">[];
  status: string;
}) {
  const paid = (doc.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totals = calcTotals({ ...doc, items: doc.items || [], extraCosts: doc.extraCosts || [], paid });
  return { totals, status: deriveStatus(doc.status, totals) };
}

/** Recalculate totals and status on a Mongoose invoice document before saving. */
export function applyTotals(invoice: any) {
  const { totals, status } = recompute(invoice.toObject());
  invoice.totals = totals;
  invoice.status = status;
}

export function clientSnapshot(client: any) {
  return {
    name: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone,
    address: client.address,
  };
}
