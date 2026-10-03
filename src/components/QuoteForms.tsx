"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, CheckCircle2, Loader2, MessageCircle, Pencil, RotateCcw, Save, Send, XCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { SERVICES } from "@/lib/constants";
import { toInputDate } from "@/lib/utils";
import { Field } from "./ui";
import { CopyButton, DeleteButton } from "./actions";
import { DownloadPdfButton } from "./DownloadPdfButton";
import { useDialogs } from "./Dialogs";
import { LineItemsEditor, linesPayload, toLines, type Lines } from "./LineItemsEditor";
import type { QuoteT, SettingsT } from "@/lib/types";
import type { ClientOption } from "./QueryForm";

const via = (v?: string | null) => (v === "portal" ? " and sent to the client's portal" : v === "email" ? " and emailed to the client" : "");

export function QuoteForm({ clients, settings, initial, defaultClientId }: { clients: ClientOption[]; settings: SettingsT; initial?: QuoteT; defaultClientId?: string }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState<"" | "save" | "send">("");
  const setup = initial?.projectSetup;
  const [f, setF] = useState({
    client: (typeof initial?.client === "string" ? initial.client : initial?.client?._id) || defaultClientId || "",
    title: initial?.title || "",
    intro: initial?.intro || "",
    validUntil: toInputDate(initial?.validUntil || new Date(Date.now() + 14 * 86400000)),
    service: setup?.service || SERVICES[0]!,
    durationDays: String(setup?.durationDays ?? 14),
    revisionLimit: String(setup?.revisionLimit ?? 2),
    checklist: (setup?.checklist || []).join("\n"),
    notes: initial?.notes ?? "",
    terms: initial?.terms ?? settings.defaultTerms ?? "",
  });
  const [lines, setLines] = useState<Lines>(toLines(initial, { currency: settings.defaultCurrency, taxPercent: settings.defaultTaxPercent }));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(send: boolean) {
    setBusy(send ? "send" : "save");
    try {
      const body = { ...f, ...linesPayload(lines), checklist: f.checklist.split("\n") };
      let id = initial?._id;
      let sentVia: string | null = null;
      if (initial) {
        await api(`/api/quotes/${initial._id}`, "PUT", body);
        if (send) sentVia = (await api<{ via: string }>(`/api/quotes/${initial._id}`, "PUT", { action: "send" })).via;
      } else {
        const r = await api<{ quote: QuoteT; via: string | null }>("/api/quotes", "POST", { ...body, send });
        id = r.quote._id;
        sentVia = r.via;
      }
      notify(send ? `Quote saved${via(sentVia)}` : "Quote saved as draft");
      router.push(`/quotes/${id}`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
      setBusy("");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      className="space-y-6"
    >
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
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
        <Field label="Valid until">
          <input className="input" type="date" value={f.validUntil} onChange={set("validUntil")} />
        </Field>
        <Field label="Proposal title *" className="sm:col-span-2">
          <input className="input" required value={f.title} onChange={set("title")} placeholder="e.g. Business website redesign" />
        </Field>
        <Field label="Introduction / scope (client sees this)" className="sm:col-span-2">
          <textarea className="input" rows={4} value={f.intro} onChange={set("intro")} placeholder="Short summary of the goal and what is included." />
        </Field>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-bold text-heading">Pricing</h2>
        <LineItemsEditor value={lines} onChange={setLines} />
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <h2 className="font-bold text-heading">When the client accepts</h2>
          <p className="text-xs text-muted">A project is created with this setup, plus an invoice for the total.</p>
        </div>
        <Field label="Service">
          <select className="input" value={f.service} onChange={set("service")}>
            {SERVICES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Delivery (days)">
          <input className="input" type="number" min="1" value={f.durationDays} onChange={set("durationDays")} />
        </Field>
        <Field label="Revision rounds">
          <input className="input" type="number" min="0" value={f.revisionLimit} onChange={set("revisionLimit")} />
        </Field>
        <Field label="Deliverables checklist (one per line, shown on the proposal)" className="sm:col-span-3">
          <textarea className="input font-mono text-xs" rows={5} value={f.checklist} onChange={set("checklist")} placeholder={"5 responsive pages\nContact form\nBasic SEO setup"} />
        </Field>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Notes">
          <textarea className="input" rows={4} value={f.notes} onChange={set("notes")} />
        </Field>
        <Field label="Terms">
          <textarea className="input" rows={4} value={f.terms} onChange={set("terms")} />
        </Field>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="submit" disabled={!!busy} className="btn btn-outline">
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
        </button>
        <button type="button" onClick={() => save(true)} disabled={!!busy} className="btn btn-primary">
          {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save and send to client
        </button>
      </div>
    </form>
  );
}

export function QuoteActions({ quote, link }: { quote: QuoteT; link: string }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [busy, setBusy] = useState("");
  const accepted = quote.status === "Accepted";

  async function act(action: string, msg: string) {
    setBusy(action);
    try {
      const r = await api<{ via?: string }>(`/api/quotes/${quote._id}`, "PUT", { action });
      notify(action === "send" ? `Quote sent${via(r.via)}` : msg);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <DownloadPdfButton fileName={`Proposal-${quote.number}`} />
      {quote.status !== "Draft" && <CopyButton text={link} />}
      {quote.status !== "Draft" && (
        <a className="btn btn-outline" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Here is your proposal ${quote.number}: ${link}`)}`}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      )}
      {!accepted && (
        <>
          <Link href={`/quotes/${quote._id}/edit`} className="btn btn-outline">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          {["Draft", "Sent"].includes(quote.status) && (
            <button onClick={() => act("send", "")} disabled={!!busy} className="btn btn-primary">
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {quote.status === "Sent" ? "Resend" : "Send to client"}
            </button>
          )}
          {quote.status === "Sent" && (
            <button
              onClick={async () => (await confirm({ title: "Mark as declined?", tone: "danger", confirmText: "Mark declined" })) && act("decline", "Marked as declined")}
              disabled={!!busy}
              className="btn btn-outline"
            >
              <XCircle className="h-4 w-4" /> Declined
            </button>
          )}
          {quote.status === "Sent" && (
            <button onClick={() => act("expire", "Marked as expired")} disabled={!!busy} className="btn btn-outline">
              <Ban className="h-4 w-4" /> Expired
            </button>
          )}
          {["Declined", "Expired"].includes(quote.status) && (
            <button onClick={() => act("reopen", "Moved back to draft")} disabled={!!busy} className="btn btn-outline">
              <RotateCcw className="h-4 w-4" /> Reopen as draft
            </button>
          )}
          <DeleteButton url={`/api/quotes/${quote._id}`} redirectTo="/quotes" confirmText={`Delete quote ${quote.number}?`} />
        </>
      )}
    </div>
  );
}

/** Public proposal page: type name, agree, accept (or decline). */
export function AcceptQuoteBox({ publicId, total }: { publicId: string; total: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<"" | "accept" | "decline">("");
  const [err, setErr] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  async function post(action: "accept" | "decline") {
    setBusy(action);
    setErr("");
    try {
      const res = await fetch(`/api/public/quotes/${publicId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "accept" ? { name, agree } : { reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="no-print mx-auto mt-6 max-w-[860px] rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-brand/5">
      <h2 className="text-lg font-bold text-heading">Accept this proposal</h2>
      <p className="mt-1 text-sm text-muted">
        Total: <b className="text-heading">{total}</b>. Accepting starts your project and creates the invoice. Your typed name works as your electronic signature.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full name" autoComplete="name" />
        <button onClick={() => post("accept")} disabled={!!busy || name.trim().length < 2 || !agree} className="btn bg-emerald-500 text-white hover:bg-emerald-600">
          {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Accept and sign
        </button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-fg">
        <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I have read this proposal, including the terms, and I agree to them.
      </label>
      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 border-t border-line pt-4">
        {declining ? (
          <div className="space-y-2">
            <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional: tell us why, so we can improve the offer" />
            <div className="flex gap-2">
              <button onClick={() => setDeclining(false)} className="btn btn-outline btn-sm">Back</button>
              <button onClick={() => post("decline")} disabled={!!busy} className="btn btn-danger btn-sm">
                {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin" />} Decline proposal
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setDeclining(true)} className="text-sm text-muted underline hover:text-fg">
            Not ready to accept? Decline or ask for changes
          </button>
        )}
      </div>
    </div>
  );
}
