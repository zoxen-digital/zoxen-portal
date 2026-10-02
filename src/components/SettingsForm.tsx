"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Save, X } from "lucide-react";
import { Field } from "./ui";
import { api } from "@/lib/client-api";
import { CURRENCIES } from "@/lib/constants";
import type { SettingsT } from "@/lib/types";

export function SettingsForm({ initial }: { initial: SettingsT }) {
  const router = useRouter();
  const [s, setS] = useState<SettingsT>(initial);
  const [member, setMember] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof SettingsT) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setS((x) => ({ ...x, [k]: e.target.value }));
  const setPay = (k: keyof SettingsT["paymentDetails"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS((x) => ({ ...x, paymentDetails: { ...x.paymentDetails, [k]: e.target.value } }));

  function addMember() {
    const m = member.trim();
    if (m && !s.teamMembers.includes(m)) setS((x) => ({ ...x, teamMembers: [...x.teamMembers, m] }));
    setMember("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await api("/api/settings", "PUT", s);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-1 font-bold text-heading">Company profile</h2>
        <p className="mb-4 text-xs text-muted">Shown on every invoice.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <input className="input" value={s.companyName} onChange={set("companyName")} required />
          </Field>
          <Field label="Tagline">
            <input className="input" value={s.tagline || ""} onChange={set("tagline")} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={s.email || ""} onChange={set("email")} placeholder="hello@zoxendigital.com" />
          </Field>
          <Field label="Phone / WhatsApp">
            <input className="input" value={s.phone || ""} onChange={set("phone")} />
          </Field>
          <Field label="Website">
            <input className="input" value={s.website || ""} onChange={set("website")} placeholder="www.zoxendigital.com" />
          </Field>
          <Field label="Address">
            <input className="input" value={s.address || ""} onChange={set("address")} />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-bold text-heading">Invoice defaults</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Invoice prefix">
            <input className="input uppercase" value={s.invoicePrefix} onChange={set("invoicePrefix")} maxLength={8} />
            <p className="mt-1 text-xs text-muted">e.g. {s.invoicePrefix || "ZD"}-{new Date().getFullYear()}-001</p>
          </Field>
          <Field label="Default currency">
            <select className="input" value={s.defaultCurrency} onChange={set("defaultCurrency")}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Default tax %">
            <input className="input" type="number" min="0" step="any" value={s.defaultTaxPercent} onChange={set("defaultTaxPercent")} />
          </Field>
          <Field label="Due in (days)">
            <input className="input" type="number" min="0" value={s.defaultDueDays} onChange={set("defaultDueDays")} />
          </Field>
          <Field label="Default notes" className="sm:col-span-2">
            <textarea className="input" rows={3} value={s.defaultNotes || ""} onChange={set("defaultNotes")} />
          </Field>
          <Field label="Default terms" className="sm:col-span-2">
            <textarea className="input" rows={3} value={s.defaultTerms || ""} onChange={set("defaultTerms")} />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-bold text-heading">Payment details</h2>
        <p className="mb-4 text-xs text-muted">Pre-filled on new invoices. Clients see these on the invoice link.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name">
            <input className="input" value={s.paymentDetails.bankName || ""} onChange={setPay("bankName")} />
          </Field>
          <Field label="Account title">
            <input className="input" value={s.paymentDetails.accountName || ""} onChange={setPay("accountName")} />
          </Field>
          <Field label="Account number">
            <input className="input" value={s.paymentDetails.accountNumber || ""} onChange={setPay("accountNumber")} />
          </Field>
          <Field label="IBAN">
            <input className="input" value={s.paymentDetails.iban || ""} onChange={setPay("iban")} />
          </Field>
          <Field label="Other payment options" className="sm:col-span-2">
            <input className="input" value={s.paymentDetails.other || ""} onChange={setPay("other")} placeholder="JazzCash / EasyPaisa: 0300-1234567" />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-bold text-heading">Team members</h2>
        <p className="mb-4 text-xs text-muted">Used for &quot;Assigned to&quot; on queries and the workload report.</p>
        <div className="flex gap-2">
          <input
            className="input max-w-sm"
            value={member}
            onChange={(e) => setMember(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMember();
              }
            }}
            placeholder="e.g. Sarah (Design)"
          />
          <button type="button" onClick={addMember} className="btn btn-outline">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {s.teamMembers.length === 0 && <span className="text-sm text-muted">No team members added yet.</span>}
          {s.teamMembers.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-3 pr-1.5 text-sm ring-1 ring-line">
              {m}
              <button
                type="button"
                onClick={() => setS((x) => ({ ...x, teamMembers: x.teamMembers.filter((t) => t !== m) }))}
                className="rounded-full p-0.5 text-muted hover:bg-red-500/10 hover:text-red-500"
                aria-label={`Remove ${m}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {err && <span className="text-sm text-red-500">{err}</span>}
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
        <button disabled={saving} className="btn btn-primary shadow-xl">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
        </button>
      </div>
    </form>
  );
}
