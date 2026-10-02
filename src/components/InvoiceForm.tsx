"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { calcTotals } from "@/lib/invoice-calc";
import { CURRENCIES, ITEM_PRESETS } from "@/lib/constants";
import { formatMoney, toInputDate } from "@/lib/utils";
import type { InvoiceT, PaymentDetails, SettingsT } from "@/lib/types";
import { Field } from "./ui";
import type { ClientOption } from "./QueryForm";

type Item = { description: string; details: string; qty: string; unit: string; rate: string };
type Extra = { label: string; amount: string };

const blankItem = (): Item => ({ description: "", details: "", qty: "1", unit: "", rate: "" });

export function InvoiceForm({
  clients,
  settings,
  initial,
  defaultClientId,
}: {
  clients: ClientOption[];
  settings: SettingsT;
  initial?: InvoiceT;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const today = new Date();
  const due = new Date(today.getTime() + (settings.defaultDueDays || 7) * 86400000);

  const [client, setClient] = useState(
    (typeof initial?.client === "string" ? initial.client : initial?.client?._id) || defaultClientId || ""
  );
  const [issueDate, setIssueDate] = useState(toInputDate(initial?.issueDate || today));
  const [dueDate, setDueDate] = useState(toInputDate(initial ? initial.dueDate : due));
  const [currency, setCurrency] = useState(initial?.currency || settings.defaultCurrency || "PKR");

  const [summary, setSummary] = useState(initial?.requirement?.summary || "");
  const [websites, setWebsites] = useState(String(initial?.requirement?.websites ?? 1));
  const [pages, setPages] = useState(String(initial?.requirement?.pages ?? ""));
  const [tags, setTags] = useState((initial?.requirement?.tags || []).join(", "));

  const [items, setItems] = useState<Item[]>(
    initial?.items?.length
      ? initial.items.map((i) => ({
          description: i.description,
          details: i.details || "",
          qty: String(i.qty),
          unit: i.unit || "",
          rate: String(i.rate),
        }))
      : [blankItem()]
  );
  const [extras, setExtras] = useState<Extra[]>(
    (initial?.extraCosts || []).map((e) => ({ label: e.label, amount: String(e.amount) }))
  );

  const [discountType, setDiscountType] = useState<"fixed" | "percent">(initial?.discountType || "fixed");
  const [discountValue, setDiscountValue] = useState(String(initial?.discountValue || ""));
  const [discountLabel, setDiscountLabel] = useState(initial?.discountLabel || "");
  const [taxPercent, setTaxPercent] = useState(String(initial?.taxPercent ?? settings.defaultTaxPercent ?? 0));
  const [advancePaid, setAdvancePaid] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState("Bank Transfer");

  const [notes, setNotes] = useState(initial?.notes ?? settings.defaultNotes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? settings.defaultTerms ?? "");
  const [payment, setPayment] = useState<PaymentDetails>({ ...settings.paymentDetails, ...(initial?.paymentDetails || {}) });

  const [paymentAction, setPaymentAction] = useState<"keep" | "unpaid" | "paid">("keep");
  const [saving, setSaving] = useState<"" | "draft" | "final">("");
  const [err, setErr] = useState("");

  const alreadyPaid = (initial?.payments || []).reduce((s, p) => s + p.amount, 0);

  const baseTotals = useMemo(
    () =>
      calcTotals({
        items: items.map((i) => ({ description: i.description, qty: Number(i.qty) || 0, rate: Number(i.rate) || 0 })),
        extraCosts: extras.map((e) => ({ label: e.label, amount: Number(e.amount) || 0 })),
        discountType,
        discountValue: Number(discountValue) || 0,
        taxPercent: Number(taxPercent) || 0,
        paid: 0,
      }),
    [items, extras, discountType, discountValue, taxPercent]
  );
  const paidPreview = !initial
    ? Number(advancePaid) || 0
    : paymentAction === "unpaid"
      ? 0
      : paymentAction === "paid"
        ? Math.max(alreadyPaid, baseTotals.total)
        : alreadyPaid;
  const totals = { ...baseTotals, paid: paidPreview, balance: Math.max(0, Math.round((baseTotals.total - paidPreview) * 100) / 100) };

  const money = (n: number) => formatMoney(n, currency);

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addPreset(p: (typeof ITEM_PRESETS)[number]) {
    const qty = p.unit === "Pages" ? String(Math.max(Number(pages) || 1, 1)) : p.unit === "Website" ? String(Math.max(Number(websites) || 1, 1)) : "1";
    const item: Item = { description: p.description, details: p.details, qty, unit: p.unit, rate: "" };
    setItems((list) => (list.length === 1 && !list[0]!.description ? [item] : [...list, item]));
  }

  function autoSummary() {
    const parts = [
      `${Number(websites) || 1} website${Number(websites) > 1 ? "s" : ""}`,
      pages ? `${pages} pages` : "",
      ...tags.split(",").map((t) => t.trim()).filter(Boolean),
    ].filter(Boolean);
    setSummary(`Business Website – ${parts.join(", ")}`);
  }

  async function submit(asDraft: boolean) {
    setErr("");
    if (!client) return setErr("Please select a client.");
    if (!items.some((i) => i.description.trim())) return setErr("Add at least one line item with a description.");
    setSaving(asDraft ? "draft" : "final");
    const body = {
      client,
      issueDate,
      dueDate,
      currency,
      requirement: { summary, websites, pages, tags },
      items,
      extraCosts: extras,
      discountType,
      discountValue,
      discountLabel,
      taxPercent,
      notes,
      terms,
      paymentDetails: payment,
      status: asDraft ? "Draft" : "Unpaid",
      ...(initial ? { paymentAction } : { advancePaid, advanceMethod }),
    };
    try {
      const saved = initial
        ? await api<InvoiceT>(`/api/invoices/${initial._id}`, "PUT", body)
        : await api<InvoiceT>("/api/invoices", "POST", body);
      router.push(`/invoices/${saved._id}${initial ? "" : "?created=1"}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setSaving("");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* Client & dates */}
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-heading">Client & dates</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Client *" className="sm:col-span-2">
              <select className="input" value={client} onChange={(e) => setClient(e.target.value)}>
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.company ? ` — ${c.company}` : ""}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="mt-1.5 text-xs text-muted">
                  No clients yet. <Link href="/clients?new=1" className="font-semibold text-brand">Add a client first</Link>.
                </p>
              )}
            </Field>
            <Field label="Issue date">
              <input type="date" className="input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label="Due date">
              <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Currency">
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {/* Requirement */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-heading">Project requirement</h2>
              <p className="text-xs text-muted">Shown at the top of the invoice so the client sees exactly what they are paying for.</p>
            </div>
            <button type="button" onClick={autoSummary} className="btn btn-outline btn-sm">
              <Wand2 className="h-3.5 w-3.5" /> Auto summary
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="No. of websites">
              <input type="number" min="0" className="input" value={websites} onChange={(e) => setWebsites(e.target.value)} />
            </Field>
            <Field label="No. of pages">
              <input type="number" min="0" className="input" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="e.g. 6" />
            </Field>
            <Field label="Features / tags (comma separated)" className="sm:col-span-2">
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Responsive, SEO Setup, WhatsApp chat" />
            </Field>
            <Field label="Requirement summary" className="sm:col-span-4">
              <input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Business Website – 1 website, 6 pages, responsive, SEO setup" />
            </Field>
          </div>
        </section>

        {/* Items */}
        <section className="card p-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="shrink-0 font-bold text-heading">Line items</h2>
            <div className="flex flex-wrap gap-1.5">
              {ITEM_PRESETS.map((p) => (
                <button key={p.description} type="button" onClick={() => addPreset(p)} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:border-brand hover:text-brand">
                  + {p.description}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface-2/50 p-3">
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <input className="input" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Description, e.g. Website Design & Development" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 md:col-span-6">
                    <input type="number" min="0" step="any" className="input" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} placeholder="Qty" title="Quantity" />
                    <input className="input" value={it.unit} onChange={(e) => updateItem(i, { unit: e.target.value })} placeholder="Unit" title="Unit, e.g. Pages, Year" />
                    <input type="number" min="0" step="any" className="input" value={it.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} placeholder="Rate" title="Rate per unit" />
                  </div>
                  <div className="flex items-center justify-end md:col-span-1">
                    <button type="button" onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, x) => x !== i) : [blankItem()]))} className="btn btn-ghost btn-sm px-2 text-red-500" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="md:col-span-9">
                    <input className="input h-9 text-xs" value={it.details} onChange={(e) => updateItem(i, { details: e.target.value })} placeholder="Short details (optional)" />
                  </div>
                  <div className="flex items-center justify-end text-sm font-bold text-heading md:col-span-3">
                    {money((Number(it.qty) || 0) * (Number(it.rate) || 0))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className="btn btn-outline btn-sm mt-3">
            <Plus className="h-4 w-4" /> Add item
          </button>
        </section>

        {/* Extra costs, discount, tax */}
        <section className="card p-5">
          <h2 className="mb-1 font-bold text-heading">Extra costs, discount & tax</h2>
          <p className="mb-4 text-xs text-muted">Extra costs are added to the subtotal (e.g. email setup, content upload, stock images).</p>
          <div className="space-y-2">
            {extras.map((ex, i) => (
              <div key={i} className="flex gap-2">
                <input className="input flex-1" value={ex.label} onChange={(e) => setExtras((l) => l.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} placeholder="Extra cost, e.g. Email setup" />
                <input type="number" min="0" step="any" className="input w-36" value={ex.amount} onChange={(e) => setExtras((l) => l.map((x, idx) => (idx === i ? { ...x, amount: e.target.value } : x)))} placeholder="Amount" />
                <button type="button" onClick={() => setExtras((l) => l.filter((_, x) => x !== i))} className="btn btn-ghost px-2 text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setExtras((l) => [...l, { label: "", amount: "" }])} className="btn btn-outline btn-sm mt-2">
            <Plus className="h-4 w-4" /> Add extra cost
          </button>

          <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-4">
            <Field label="Discount type">
              <select className="input" value={discountType} onChange={(e) => setDiscountType(e.target.value as "fixed" | "percent")}>
                <option value="fixed">Fixed amount</option>
                <option value="percent">Percentage %</option>
              </select>
            </Field>
            <Field label={discountType === "percent" ? "Discount %" : "Discount amount"}>
              <input type="number" min="0" step="any" className="input" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Discount label">
              <input className="input" value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} placeholder="Special launch discount" />
            </Field>
            <Field label="Tax %">
              <input type="number" min="0" step="any" className="input" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
            </Field>
          </div>

          {!initial && (
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <Field label="Advance received">
                <input type="number" min="0" step="any" className="input" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Advance method">
                <input className="input" value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value)} placeholder="Bank Transfer" />
              </Field>
            </div>
          )}
          {initial && (
            <div className="mt-5 border-t border-line pt-5">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-heading">Payment status</h3>
                <span className="text-xs text-muted">
                  Currently <b className="text-fg">{initial.status}</b> · {money(alreadyPaid)} received
                </span>
              </div>
              <p className="mb-3 text-xs text-muted">If you change the price, the status updates automatically (e.g. Paid becomes Partially Paid when the total goes up).</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { v: "keep", title: "Keep payments", text: alreadyPaid ? `Keep ${money(alreadyPaid)} as received` : "No payments recorded" },
                    { v: "unpaid", title: "Mark as Unpaid", text: "Remove all recorded payments" },
                    { v: "paid", title: "Mark as Paid", text: "Record the remaining balance as received" },
                  ] as const
                ).map((o) => (
                  <label
                    key={o.v}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition ${
                      paymentAction === o.v ? "border-brand bg-brand/5 ring-2 ring-brand/15" : "border-line hover:bg-surface-2"
                    }`}
                  >
                    <input type="radio" name="paymentAction" className="mt-1 accent-[#2639E8]" checked={paymentAction === o.v} onChange={() => setPaymentAction(o.v)} />
                    <span>
                      <span className="block font-semibold text-heading">{o.title}</span>
                      <span className="text-xs text-muted">{o.text}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Individual payments can also be added or removed from the invoice page.</p>
            </div>
          )}
        </section>

        {/* Payment details & notes */}
        <section className="card p-5">
          <h2 className="mb-1 font-bold text-heading">Payment details & notes</h2>
          <p className="mb-4 text-xs text-muted">Defaults come from Settings. Change them here for this invoice only.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name">
              <input className="input" value={payment.bankName || ""} onChange={(e) => setPayment((p) => ({ ...p, bankName: e.target.value }))} />
            </Field>
            <Field label="Account title">
              <input className="input" value={payment.accountName || ""} onChange={(e) => setPayment((p) => ({ ...p, accountName: e.target.value }))} />
            </Field>
            <Field label="Account number">
              <input className="input" value={payment.accountNumber || ""} onChange={(e) => setPayment((p) => ({ ...p, accountNumber: e.target.value }))} />
            </Field>
            <Field label="IBAN">
              <input className="input" value={payment.iban || ""} onChange={(e) => setPayment((p) => ({ ...p, iban: e.target.value }))} />
            </Field>
            <Field label="Other payment options" className="sm:col-span-2">
              <input className="input" value={payment.other || ""} onChange={(e) => setPayment((p) => ({ ...p, other: e.target.value }))} placeholder="JazzCash / EasyPaisa: 0300-1234567" />
            </Field>
            <Field label="Notes (shown to client)">
              <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Terms & conditions">
              <textarea className="input" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </Field>
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="card overflow-hidden">
          <div className="relative overflow-hidden bg-brand-gradient p-5 text-white">
            <svg className="absolute -right-10 -top-6 h-32 w-56 opacity-40" viewBox="0 0 200 100" aria-hidden="true">
              <ellipse cx="100" cy="50" rx="95" ry="26" transform="rotate(-18 100 50)" fill="none" stroke="#fff" />
              <circle cx="182" cy="18" r="5" fill="#fff" />
            </svg>
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <FileText className="h-4 w-4" /> {initial ? initial.invoiceNumber : "New invoice"}
            </div>
            <div className="mt-2 text-sm text-white/80">Balance due</div>
            <div className="text-3xl font-extrabold">{money(totals.balance)}</div>
          </div>
          <div className="space-y-2.5 p-5 text-sm">
            <Row label="Items" value={money(totals.itemsTotal)} />
            <Row label="Extra costs" value={money(totals.extrasTotal)} />
            <Row label="Subtotal" value={money(totals.subtotal)} strong />
            <Row label={`Discount${discountType === "percent" && discountValue ? ` (${discountValue}%)` : ""}`} value={`- ${money(totals.discount)}`} accent="text-emerald-600" />
            <Row label={`Tax (${Number(taxPercent) || 0}%)`} value={money(totals.tax)} />
            <div className="border-t border-line pt-2.5">
              <Row label={`Total (${currency})`} value={money(totals.total)} strong />
            </div>
            <Row label={initial ? "Paid so far" : "Advance paid"} value={money(totals.paid)} />
            <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
              <span className="font-semibold text-brand dark:text-[#8f9bff]">Balance due</span>
              <span className="text-lg font-extrabold text-gradient">{money(totals.balance)}</span>
            </div>

            {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

            <div className="space-y-2 pt-2">
              <button onClick={() => submit(false)} disabled={!!saving} className="btn btn-primary w-full">
                {saving === "final" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {initial ? "Save invoice" : "Generate invoice & link"}
              </button>
              <button onClick={() => submit(true)} disabled={!!saving} className="btn btn-outline w-full">
                {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save as draft
              </button>
              <p className="text-center text-[11px] text-muted">Drafts are hidden from the client link until you generate them.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold text-heading" : "text-muted"}>{label}</span>
      <span className={`${strong ? "font-bold text-heading" : "font-medium text-fg"} ${accent || ""}`}>{value}</span>
    </div>
  );
}
