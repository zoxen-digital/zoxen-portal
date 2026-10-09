"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/client-api";
import { CURRENCIES } from "@/lib/constants";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";

export type ExpenseRow = {
  _id: string;
  title: string;
  category: string;
  vendor: string;
  amount: number;
  currency: string;
  cycle: string;
  date: string;
  renewsOn: string | null;
  client: string | null;
  notes: string;
  active: boolean;
};
type ClientOpt = { _id: string; name: string; company?: string };

const CATEGORIES = ["Domain", "Hosting", "Database", "Email", "Software", "Ads", "Salary", "Office", "Other"];
const CYCLES = ["Monthly", "Yearly", "One-time"];

/** Common costs, so adding one is two taps. */
const PRESETS: { title: string; category: string; vendor: string; cycle: string }[] = [
  { title: "Domain", category: "Domain", vendor: "Namecheap", cycle: "Yearly" },
  { title: "Vercel Pro", category: "Hosting", vendor: "Vercel", cycle: "Monthly" },
  { title: "MongoDB Atlas", category: "Database", vendor: "MongoDB", cycle: "Monthly" },
  { title: "Google Workspace", category: "Email", vendor: "Google", cycle: "Monthly" },
  { title: "Hosting", category: "Hosting", vendor: "Hostinger", cycle: "Yearly" },
  { title: "ChatGPT / AI tools", category: "Software", vendor: "", cycle: "Monthly" },
];

const day = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function ExpenseModal({ open, onClose, initial, currency, clients }: { open: boolean; onClose: () => void; initial?: ExpenseRow; currency: string; clients: ClientOpt[] }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  const blank = { title: "", category: "Hosting", vendor: "", amount: "", currency, cycle: "Monthly", date: day(new Date().toISOString()), renewsOn: "", client: "", notes: "", active: true };
  const [f, setF] = useState(blank);

  useEffect(() => {
    if (!open) return;
    setF(
      initial
        ? {
            title: initial.title,
            category: initial.category,
            vendor: initial.vendor,
            amount: String(initial.amount),
            currency: initial.currency,
            cycle: initial.cycle,
            date: day(initial.date),
            renewsOn: day(initial.renewsOn),
            client: initial.client || "",
            notes: initial.notes,
            active: initial.active,
          }
        : blank
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, amount: Number(f.amount), client: f.client || null, renewsOn: f.renewsOn || null };
      if (initial) await api(`/api/expenses/${initial._id}`, "PUT", body);
      else await api("/api/expenses", "POST", body);
      notify(initial ? "Expense updated" : "Expense added");
      onClose();
      router.refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit expense" : "Add expense"} subtitle="Domains, hosting, tools, ads or anything the business pays for." size="lg">
      <form onSubmit={submit} className="space-y-4">
        {!initial && (
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.title}
                onClick={() => setF((x) => ({ ...x, ...p }))}
                className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand"
              >
                + {p.title}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What is it for? *">
            <input className="input" required value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. zoxendigital.com domain" />
          </Field>
          <Field label="Paid to (vendor)">
            <input className="input" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="e.g. Namecheap, Vercel" />
          </Field>
          <Field label="Category">
            <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="How often is it paid?">
            <select className="input" value={f.cycle} onChange={(e) => set("cycle", e.target.value)}>
              {CYCLES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount *">
            <div className="flex gap-2">
              <select className="input w-24 shrink-0" value={f.currency} onChange={(e) => set("currency", e.target.value)} aria-label="Currency">
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input className="input" required type="number" min="0" step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" />
            </div>
          </Field>
          <Field label={f.cycle === "One-time" ? "Paid on" : "Started on"}>
            <input className="input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          {f.cycle !== "One-time" && (
            <Field label="Next renewal date">
              <input className="input" type="date" value={f.renewsOn} onChange={(e) => set("renewsOn", e.target.value)} />
              <p className="mt-1 text-xs text-muted">You get a reminder 7 days before.</p>
            </Field>
          )}
          <Field label="For a client? (optional)">
            <select className="input" value={f.client} onChange={(e) => set("client", e.target.value)}>
              <option value="">No, a business cost</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Account email, plan name, card used..." />
        </Field>
        {initial && f.cycle !== "One-time" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
            Still paying for this (untick if cancelled)
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save" : "Add expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function NewExpenseButton({ currency, clients }: { currency: string; clients: ClientOpt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="h-4 w-4" /> Add expense
      </button>
      <ExpenseModal open={open} onClose={() => setOpen(false)} currency={currency} clients={clients} />
    </>
  );
}

export function EditExpenseButton({ expense, clients }: { expense: ExpenseRow; clients: ClientOpt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-ghost btn-sm px-2" aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      <ExpenseModal open={open} onClose={() => setOpen(false)} initial={expense} currency={expense.currency} clients={clients} />
    </>
  );
}
