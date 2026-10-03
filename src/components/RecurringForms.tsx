"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Play, Plus } from "lucide-react";
import { api } from "@/lib/client-api";
import { toInputDate } from "@/lib/utils";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";
import { LineItemsEditor, linesPayload, toLines, type Lines } from "./LineItemsEditor";
import type { ClientT, RecurringPlanT, SettingsT } from "@/lib/types";
import type { ClientOption } from "./QueryForm";

export function RecurringFormModal({
  open,
  onClose,
  initial,
  clients,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  initial?: RecurringPlanT;
  clients: ClientOption[];
  settings: Pick<SettingsT, "defaultCurrency" | "defaultTaxPercent" | "defaultDueDays" | "defaultNotes" | "defaultTerms">;
}) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  const firstOfNextMonth = () => {
    const d = new Date();
    return toInputDate(new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)));
  };
  const [f, setF] = useState({ client: "", title: "", interval: "monthly", nextRunAt: firstOfNextMonth(), dueDays: "7", notes: "", terms: "" });
  const [lines, setLines] = useState<Lines>(toLines(undefined, { currency: settings.defaultCurrency, taxPercent: settings.defaultTaxPercent }));

  useEffect(() => {
    if (!open) return;
    const c = initial?.client as ClientT | string | null | undefined;
    setF({
      client: (typeof c === "string" ? c : c?._id) || "",
      title: initial?.title || "",
      interval: initial?.interval || "monthly",
      nextRunAt: initial ? toInputDate(initial.nextRunAt) : firstOfNextMonth(),
      dueDays: String(initial?.dueDays ?? settings.defaultDueDays ?? 7),
      notes: initial?.notes ?? settings.defaultNotes ?? "",
      terms: initial?.terms ?? settings.defaultTerms ?? "",
    });
    setLines(toLines(initial, { currency: settings.defaultCurrency, taxPercent: settings.defaultTaxPercent }));
  }, [open, initial, settings]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, ...linesPayload(lines) };
      if (initial) await api(`/api/recurring/${initial._id}`, "PUT", body);
      else await api("/api/recurring", "POST", body);
      notify(initial ? "Plan updated" : "Recurring plan created");
      onClose();
      router.refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit recurring plan" : "New recurring invoice"} subtitle="An invoice is created and sent to the client automatically on each date." size="xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client *">
            <select className="input" required value={f.client} onChange={set("client")} disabled={!!initial}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plan name *">
            <input className="input" required value={f.title} onChange={set("title")} placeholder="e.g. Monthly SEO & maintenance" />
          </Field>
          <Field label="Repeats">
            <select className="input" value={f.interval} onChange={set("interval")}>
              <option value="monthly">Every month</option>
              <option value="quarterly">Every 3 months</option>
              <option value="yearly">Every year</option>
            </select>
          </Field>
          <Field label="Next invoice date *">
            <input className="input" type="date" required value={f.nextRunAt} onChange={set("nextRunAt")} />
          </Field>
          <Field label="Payment due (days after invoice)">
            <input className="input" type="number" min="0" max="90" value={f.dueDays} onChange={set("dueDays")} />
          </Field>
        </div>
        <div>
          <span className="label">Each invoice</span>
          <LineItemsEditor value={lines} onChange={setLines} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notes">
            <textarea className="input" rows={3} value={f.notes} onChange={set("notes")} />
          </Field>
          <Field label="Terms">
            <textarea className="input" rows={3} value={f.terms} onChange={set("terms")} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save plan" : "Create plan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type FormSettings = Parameters<typeof RecurringFormModal>[0]["settings"];

export function NewRecurringButton({ clients, settings }: { clients: ClientOption[]; settings: FormSettings }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="h-4 w-4" /> New recurring invoice
      </button>
      <RecurringFormModal open={open} onClose={() => setOpen(false)} clients={clients} settings={settings} />
    </>
  );
}

export function RecurringRowActions({ plan, clients, settings }: { plan: RecurringPlanT; clients: ClientOption[]; settings: FormSettings }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function runNow() {
    const ok = await confirm({
      title: "Create this period's invoice now?",
      message: "The invoice is created and sent to the client now, and the next date moves forward by one period.",
      confirmText: "Create invoice",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api<{ invoiceNumber: string }>(`/api/recurring/${plan._id}/run`, "POST");
      notify(`Invoice ${r.invoiceNumber} created and sent`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <button onClick={runNow} disabled={busy || !plan.active} className="btn btn-ghost btn-sm px-2" title="Create this period's invoice now">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      </button>
      <button onClick={() => setOpen(true)} className="btn btn-ghost btn-sm px-2" title="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      <RecurringFormModal open={open} onClose={() => setOpen(false)} initial={plan} clients={clients} settings={settings} />
    </div>
  );
}
