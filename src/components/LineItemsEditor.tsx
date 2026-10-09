"use client";

import { Plus, Trash2 } from "lucide-react";
import { calcTotals } from "@/lib/invoice-calc";
import { CURRENCIES } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";
import { Field } from "./ui";
import type { InvoiceItem } from "@/lib/types";

import { PackagePicker } from "./PackagePicker";

export type LineItem = { description: string; details: string; qty: string; unit: string; rate: string };
export type Lines = { items: LineItem[]; currency: string; discountType: "fixed" | "percent"; discountValue: string; taxPercent: string };

export const blankLine = (): LineItem => ({ description: "", details: "", qty: "1", unit: "", rate: "" });

export function toLines(
  src: { items?: InvoiceItem[]; currency?: string; discountType?: "fixed" | "percent"; discountValue?: number; taxPercent?: number } | undefined,
  defaults: { currency: string; taxPercent?: number }
): Lines {
  return {
    items: src?.items?.length
      ? src.items.map((i) => ({ description: i.description, details: i.details || "", qty: String(i.qty ?? 1), unit: i.unit || "", rate: String(i.rate ?? 0) }))
      : [blankLine()],
    currency: src?.currency || defaults.currency,
    discountType: src?.discountType || "fixed",
    discountValue: src?.discountValue ? String(src.discountValue) : "",
    taxPercent: String(src?.taxPercent ?? defaults.taxPercent ?? 0),
  };
}

/** Body fields the API expects (numbers as numbers). */
export function linesPayload(l: Lines) {
  return {
    items: l.items.filter((i) => i.description.trim()).map((i) => ({ ...i, qty: Number(i.qty) || 0, rate: Number(i.rate) || 0 })),
    currency: l.currency,
    discountType: l.discountType,
    discountValue: Number(l.discountValue) || 0,
    taxPercent: Number(l.taxPercent) || 0,
  };
}

/** Editable list of priced line items with live totals. */
export function LineItemsEditor({ value, onChange, pricing = true }: { value: Lines; onChange: (v: Lines) => void; pricing?: boolean }) {
  const p = linesPayload(value);
  const totals = calcTotals({ items: p.items, extraCosts: [], discountType: p.discountType, discountValue: p.discountValue, taxPercent: pricing ? p.taxPercent : 0, paid: 0 });
  const setItem = (i: number, k: keyof LineItem, v: string) => onChange({ ...value, items: value.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-line p-3">
            <input className="input col-span-12 sm:col-span-5" placeholder="Item / service *" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
            <input className="input col-span-4 sm:col-span-2" type="number" min="0" step="any" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
            <input className="input col-span-4 sm:col-span-2" placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} />
            <input className="input col-span-4 sm:col-span-2" type="number" min="0" step="any" placeholder="Rate" value={it.rate} onChange={(e) => setItem(i, "rate", e.target.value)} />
            <button
              type="button"
              onClick={() => onChange({ ...value, items: value.items.length > 1 ? value.items.filter((_, j) => j !== i) : [blankLine()] })}
              className="btn btn-ghost col-span-12 px-2 hover:text-red-500 sm:col-span-1"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <input className="input col-span-12" placeholder="Details (optional)" value={it.details} onChange={(e) => setItem(i, "details", e.target.value)} />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange({ ...value, items: [...value.items, blankLine()] })} className="btn btn-outline btn-sm">
            <Plus className="h-4 w-4" /> Add item
          </button>
          {pricing && (
            <PackagePicker
              onPick={(lines, pkg) => {
                const kept = value.items.filter((i) => i.description.trim() || i.rate);
                onChange({ ...value, items: [...kept, ...lines], currency: kept.length ? value.currency : pkg.currency });
              }}
            />
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Currency">
          <select className="input" value={value.currency} onChange={(e) => onChange({ ...value, currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {pricing && (
          <>
            <Field label="Discount">
              <input className="input" type="number" min="0" step="any" value={value.discountValue} onChange={(e) => onChange({ ...value, discountValue: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Discount type">
              <select className="input" value={value.discountType} onChange={(e) => onChange({ ...value, discountType: e.target.value as "fixed" | "percent" })}>
                <option value="fixed">Fixed amount</option>
                <option value="percent">Percent %</option>
              </select>
            </Field>
            <Field label="Tax %">
              <input className="input" type="number" min="0" step="any" value={value.taxPercent} onChange={(e) => onChange({ ...value, taxPercent: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      <div className="ml-auto max-w-xs space-y-1 rounded-xl bg-surface-2 p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatMoney(totals.subtotal, value.currency)}</span></div>
        {pricing && totals.discount > 0 && <div className="flex justify-between"><span className="text-muted">Discount</span><span>-{formatMoney(totals.discount, value.currency)}</span></div>}
        {pricing && totals.tax > 0 && <div className="flex justify-between"><span className="text-muted">Tax</span><span>{formatMoney(totals.tax, value.currency)}</span></div>}
        <div className="flex justify-between border-t border-line pt-1 text-base font-bold text-heading"><span>Total</span><span>{formatMoney(totals.total, value.currency)}</span></div>
      </div>
    </div>
  );
}
