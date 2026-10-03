"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, CheckCircle2, ExternalLink, Loader2, Mail, MessageCircle, Pencil, Plus, RotateCcw, Send, Trash2, Undo2, Wallet } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { CopyButton, DeleteButton } from "./actions";
import { useDialogs } from "./Dialogs";
import { DownloadPdfButton } from "./DownloadPdfButton";
import { api } from "@/lib/client-api";
import { formatDate, formatMoney, toInputDate } from "@/lib/utils";
import type { InvoiceT } from "@/lib/types";

function useShareUrl(publicId: string) {
  const [url, setUrl] = useState(`/invoice/${publicId}`);
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setUrl(`${base.replace(/\/$/, "")}/invoice/${publicId}`);
  }, [publicId]);
  return url;
}

export function InvoiceActions({ invoice }: { invoice: InvoiceT }) {
  const router = useRouter();
  const { confirm, notify } = useDialogs();
  const [busy, setBusy] = useState("");
  const isDraft = invoice.status === "Draft";
  const isCancelled = invoice.status === "Cancelled";

  async function patch(status: string, done: string) {
    setBusy(status);
    try {
      await api(`/api/invoices/${invoice._id}`, "PATCH", { status });
      notify(done);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  async function markPaid() {
    const ok = await confirm({
      title: "Mark this invoice as paid?",
      message: (
        <>
          This records the full balance of <b className="text-heading">{formatMoney(invoice.totals.balance, invoice.currency)}</b> as received for{" "}
          {invoice.invoiceNumber}.
        </>
      ),
      confirmText: "Yes, mark as paid",
      tone: "success",
    });
    if (!ok) return;
    setBusy("paid");
    try {
      await api(`/api/invoices/${invoice._id}/payments`, "POST", { full: true, note: "Marked as paid" });
      notify(`${invoice.invoiceNumber} marked as paid`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  async function markUnpaid() {
    const ok = await confirm({
      title: "Mark this invoice as unpaid?",
      message: (
        <>
          All recorded payments (<b className="text-heading">{formatMoney(invoice.totals.paid, invoice.currency)}</b>) will be removed and the full
          amount will show as due again.
        </>
      ),
      confirmText: "Yes, mark as unpaid",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("unpaid");
    try {
      await api(`/api/invoices/${invoice._id}`, "PATCH", { clearPayments: true });
      notify(`${invoice.invoiceNumber} marked as unpaid`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <DownloadPdfButton fileName={`Invoice-${invoice.invoiceNumber}`} />
      <Link href={`/invoices/${invoice._id}/edit`} className="btn btn-outline">
        <Pencil className="h-4 w-4" /> Edit
      </Link>
      {isDraft ? (
        <button onClick={() => patch("Unpaid", "Invoice generated and the client was notified.")} disabled={!!busy} className="btn btn-primary">
          {busy === "Unpaid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Generate & activate link
        </button>
      ) : (
        <>
          {!isCancelled && invoice.totals.balance > 0 && (
            <>
              <SendReminderButton invoice={invoice} />
              <RecordPaymentButton invoice={invoice} />
              <button onClick={markPaid} disabled={!!busy} className="btn btn-outline">
                {busy === "paid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />} Mark as paid
              </button>
            </>
          )}
          {!isCancelled && invoice.totals.paid > 0 && (
            <button onClick={markUnpaid} disabled={!!busy} className="btn btn-outline">
              {busy === "unpaid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4 text-amber-500" />} Mark as unpaid
            </button>
          )}
          {isCancelled ? (
            <button onClick={() => patch("Unpaid", "Invoice restored")} disabled={!!busy} className="btn btn-outline">
              <RotateCcw className="h-4 w-4" /> Restore
            </button>
          ) : (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Cancel this invoice?",
                  message: "The client link will stop working. You can restore it later.",
                  confirmText: "Yes, cancel invoice",
                  cancelText: "Keep it",
                  tone: "danger",
                });
                if (ok) patch("Cancelled", "Invoice cancelled");
              }}
              disabled={!!busy}
              className="btn btn-outline"
            >
              <Ban className="h-4 w-4" /> Cancel
            </button>
          )}
        </>
      )}
      <DeleteButton url={`/api/invoices/${invoice._id}`} redirectTo="/invoices" confirmText={`Delete invoice ${invoice.invoiceNumber} permanently?`} />
    </div>
  );
}

function SendReminderButton({ invoice }: { invoice: InvoiceT }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ via: string }>(`/api/invoices/${invoice._id}/remind`, "POST", { note });
      notify(res.via === "portal" ? "Reminder sent to the client's portal, phone and email" : "Reminder emailed to the client");
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-outline">
        <Mail className="h-4 w-4" /> Send reminder
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Send payment reminder"
        subtitle={
          invoice.lastReminderAt
            ? `Last reminder: ${formatDate(invoice.lastReminderAt)} · ${invoice.reminderCount || 1} sent so far`
            : `Balance due: ${formatMoney(invoice.totals.balance, invoice.currency)}`
        }
      >
        <form onSubmit={send} className="space-y-4">
          <p className="text-sm text-muted">
            The client gets a polite reminder with a link to view and pay this invoice: in their portal, as a phone alert and by email.
          </p>
          <Field label="Personal note (optional)">
            <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. We start the next phase once this is cleared." />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send reminder
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ShareCard({ invoice, companyName, created }: { invoice: InvoiceT; companyName: string; created?: boolean }) {
  const url = useShareUrl(invoice.publicId);
  const phone = (invoice.clientSnapshot?.phone || "").replace(/[^\d]/g, "");
  const message = `Hello ${invoice.clientSnapshot?.name || ""}, here is your invoice ${invoice.invoiceNumber} from ${companyName} for ${formatMoney(
    invoice.totals.total,
    invoice.currency
  )}. Balance due: ${formatMoney(invoice.totals.balance, invoice.currency)}${
    invoice.dueDate ? ` by ${formatDate(invoice.dueDate)}` : ""
  }.\n\nView invoice: ${url}\n\nThank you!`;
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  const mail = `mailto:${invoice.clientSnapshot?.email || ""}?subject=${encodeURIComponent(`Invoice ${invoice.invoiceNumber} from ${companyName}`)}&body=${encodeURIComponent(message)}`;

  if (invoice.status === "Draft") {
    return (
      <div className="card border-dashed p-5">
        <div className="font-bold text-heading">This invoice is a draft</div>
        <p className="mt-1 text-sm text-muted">The client link is not active yet. Click &quot;Generate & activate link&quot; when it is ready to send.</p>
      </div>
    );
  }
  if (invoice.status === "Cancelled") {
    return (
      <div className="card border-dashed p-5">
        <div className="font-bold text-heading">This invoice is cancelled</div>
        <p className="mt-1 text-sm text-muted">The client link no longer shows this invoice.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {created && (
        <div className="flex items-center gap-2 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Invoice generated. Share the link below with your client.
        </div>
      )}
      <div className="p-5">
        <div className="mb-2 text-sm font-bold text-heading">Client invoice link</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} className="input flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
          <CopyButton text={url} />
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-outline">
            <ExternalLink className="h-4 w-4" /> Open
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={wa} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
            <MessageCircle className="h-4 w-4 text-emerald-500" /> Send on WhatsApp
          </a>
          <a href={mail} className="btn btn-outline btn-sm">
            <Mail className="h-4 w-4 text-brand" /> Send by email
          </a>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentButton({ invoice }: { invoice: InvoiceT }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toInputDate(new Date()));
  const [method, setMethod] = useState("Bank Transfer");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await api(`/api/invoices/${invoice._id}/payments`, "POST", { amount, date, method, note });
      notify("Payment recorded");
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Wallet className="h-4 w-4" /> Record payment
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Record payment" subtitle={`Balance due: ${formatMoney(invoice.totals.balance, invoice.currency)}`}>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount (${invoice.currency}) *`}>
            <input type="number" min="0" step="any" required autoFocus className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button type="button" onClick={() => setAmount(String(invoice.totals.balance))} className="mt-1 text-xs font-semibold text-brand">
              Use full balance
            </button>
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Method">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["Bank Transfer", "Cash", "JazzCash", "EasyPaisa", "Card", "PayPal", "Wise", "Other"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Note / reference">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transaction ID" />
          </Field>
          {err && <p className="text-sm text-red-500 sm:col-span-2">{err}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save payment
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function RemovePaymentButton({ invoiceId, index }: { invoiceId: string; index: number }) {
  const router = useRouter();
  const { confirm, notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  async function run() {
    const ok = await confirm({
      title: "Remove this payment?",
      message: "The invoice balance and status will be recalculated.",
      confirmText: "Yes, remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/invoices/${invoiceId}/payments`, "DELETE", { index });
      notify("Payment removed");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={run} disabled={busy} className="btn btn-ghost btn-sm px-2 text-red-500" title="Remove payment">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
