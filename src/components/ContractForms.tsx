"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Loader2, MessageCircle, Pencil, RotateCcw, Save, Send, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { Field } from "./ui";
import { CopyButton, DeleteButton } from "./actions";
import { DownloadPdfButton } from "./DownloadPdfButton";
import { useDialogs } from "./Dialogs";
import type { ContractT } from "@/lib/types";

const via = (v?: string | null) => (v === "portal" ? " and sent to the client's portal" : v === "email" ? " and emailed to the client" : "");

/** Create (with client / quote / project preset) or edit a contract's title and text. */
export function ContractForm({
  initial,
  preset,
  onDone,
}: {
  initial?: ContractT;
  preset?: { client: string; quote?: string; project?: string; title: string; body: string };
  onDone?: () => void;
}) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [title, setTitle] = useState(initial?.title || preset?.title || "");
  const [body, setBody] = useState(initial?.body || preset?.body || "");
  const [busy, setBusy] = useState<"" | "save" | "send">("");

  async function save(send: boolean) {
    setBusy(send ? "send" : "save");
    try {
      if (initial) {
        await api(`/api/contracts/${initial._id}`, "PUT", { title, body });
        let sent: string | null = null;
        if (send) sent = (await api<{ via: string }>(`/api/contracts/${initial._id}`, "PUT", { action: "send" })).via;
        notify(send ? `Contract saved${via(sent)}` : "Contract saved");
        onDone?.();
        router.refresh();
      } else {
        const r = await api<{ contract: ContractT; via: string | null }>("/api/contracts", "POST", { ...preset, title, body, send });
        notify(send ? `Contract created${via(r.via)}` : "Contract saved as draft");
        router.push(`/contracts/${r.contract._id}`);
      }
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <Field label="Title *">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Website Development Agreement" />
      </Field>
      <Field label="Agreement text *">
        <textarea className="input font-mono text-[13px] leading-relaxed" rows={22} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        {onDone && (
          <button onClick={onDone} className="btn btn-outline">
            <X className="h-4 w-4" /> Cancel
          </button>
        )}
        <button onClick={() => save(false)} disabled={!!busy} className="btn btn-outline">
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
        </button>
        <button onClick={() => save(true)} disabled={!!busy} className="btn btn-primary">
          {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save and send for signature
        </button>
      </div>
    </div>
  );
}

export function ContractActions({ contract, link, children }: { contract: ContractT; link: string; children?: React.ReactNode }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(false);
  const signed = contract.status === "Signed";

  async function act(action: string, msg: string) {
    setBusy(action);
    try {
      const r = await api<{ via?: string }>(`/api/contracts/${contract._id}`, "PUT", { action });
      notify(action === "send" ? `Sent for signature${via(r.via)}` : msg);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  if (editing) return <ContractForm initial={contract} onDone={() => setEditing(false)} />;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <DownloadPdfButton fileName={`Agreement-${contract.number}`} />
        {contract.status !== "Draft" && <CopyButton text={link} />}
        {contract.status === "Sent" && (
          <a className="btn btn-outline" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Please review and sign the agreement: ${link}`)}`}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        {!signed && contract.status !== "Void" && (
          <>
            <button onClick={() => setEditing(true)} className="btn btn-outline">
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button onClick={() => act("send", "")} disabled={!!busy} className="btn btn-primary">
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {contract.status === "Sent" ? "Resend" : "Send for signature"}
            </button>
            <button
              onClick={async () => (await confirm({ title: "Void this contract?", message: "The signing link stops working.", tone: "danger", confirmText: "Void" })) && act("void", "Contract voided")}
              disabled={!!busy}
              className="btn btn-outline"
            >
              <Ban className="h-4 w-4" /> Void
            </button>
          </>
        )}
        {contract.status === "Void" && (
          <button onClick={() => act("reopen", "Moved back to draft")} disabled={!!busy} className="btn btn-outline">
            <RotateCcw className="h-4 w-4" /> Reopen as draft
          </button>
        )}
        {!signed && <DeleteButton url={`/api/contracts/${contract._id}`} redirectTo="/contracts" confirmText={`Delete contract ${contract.number}?`} />}
      </div>
      {children}
    </>
  );
}

/** Public signing box. */
export function SignContractBox({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function sign() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/public/contracts/${publicId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, agree }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not sign");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print mx-auto mt-6 max-w-[860px] rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-brand/5">
      <h2 className="text-lg font-bold text-heading">Sign this agreement</h2>
      <p className="mt-1 text-sm text-muted">Type your full legal name. It works as your electronic signature; the date, time and IP address are recorded.</p>
      <input className="input mt-4 font-serif text-xl italic" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />
      <label className="mt-3 flex items-start gap-2 text-sm text-fg">
        <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have read this agreement and I agree to its terms.
      </label>
      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      <button onClick={sign} disabled={busy || name.trim().length < 2 || !agree} className="btn mt-4 w-full bg-emerald-500 text-white hover:bg-emerald-600 sm:w-auto">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Sign agreement
      </button>
    </div>
  );
}
