import type { ExtraCost, InvoiceItem, Totals } from "./types";

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcTotals(input: {
  items: InvoiceItem[];
  extraCosts: ExtraCost[];
  discountType: "fixed" | "percent";
  discountValue: number;
  taxPercent: number;
  paid: number;
}): Totals {
  const itemsTotal = input.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const extrasTotal = input.extraCosts.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const subtotal = itemsTotal + extrasTotal;

  const dv = Math.max(0, Number(input.discountValue) || 0);
  const discount = Math.min(subtotal, input.discountType === "percent" ? (subtotal * dv) / 100 : dv);

  const taxable = subtotal - discount;
  const tax = (taxable * Math.max(0, Number(input.taxPercent) || 0)) / 100;
  const total = taxable + tax;
  const paid = Math.max(0, Number(input.paid) || 0);

  return {
    itemsTotal: round(itemsTotal),
    extrasTotal: round(extrasTotal),
    subtotal: round(subtotal),
    discount: round(discount),
    tax: round(tax),
    total: round(total),
    paid: round(paid),
    balance: round(Math.max(0, total - paid)),
  };
}

/** Draft and Cancelled are manual states; everything else follows the payments. */
export function deriveStatus(current: string, totals: Totals) {
  if (current === "Draft" || current === "Cancelled") return current;
  if (totals.total > 0 && totals.paid >= totals.total) return "Paid";
  if (totals.paid > 0) return "Partially Paid";
  return "Unpaid";
}
