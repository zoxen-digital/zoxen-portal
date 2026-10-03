"use client";

import { useState } from "react";
import { ClipboardList, Eye, Loader2, MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";
import { Modal } from "./Modal";
import { Badge } from "./ui";
import { CopyButton } from "./actions";
import { useDialogs } from "./Dialogs";

/** Gets the client's personal form link and shares it (copy, WhatsApp, or portal + email). */
export function SendOnboardingButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<"" | "load" | "send">("");

  async function openModal() {
    setOpen(true);
    if (link) return;
    setBusy("load");
    try {
      setLink((await api<{ link: string }>(`/api/clients/${clientId}/onboarding-link`, "POST", {})).link);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  async function send() {
    setBusy("send");
    try {
      const r = await api<{ via: string }>(`/api/clients/${clientId}/onboarding-link`, "POST", { send: true });
      notify(r.via === "portal" ? "Sent to the client's portal, phone and email" : r.via === "email" ? "Emailed to the client" : "Copy the link and send it on WhatsApp (no portal login or email yet)", r.via === "none" ? "info" : "success");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <button onClick={openModal} className="btn btn-outline">
        <ClipboardList className="h-4 w-4" /> Send onboarding form
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Onboarding form" subtitle={`Personal link for ${clientName}. Answers arrive tagged to this client, ready to approve.`}>
        {busy === "load" || !link ? (
          <div className="flex justify-center py-6 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <input className="input font-mono text-xs" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap justify-end gap-2">
              <a
                className="btn btn-outline"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`Hi! Please fill in our project onboarding form so we can start your website: ${link}`)}`}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <CopyButton text={link} />
              <button onClick={send} disabled={!!busy} className="btn btn-primary">
                {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to client
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/** One onboarding form row with a "View answers" modal (answers rendered on the server). */
export function OnboardingFormRow({ title, status, date, children }: { title: string; status: string; date: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-heading">{title}</div>
        <div className="text-xs text-muted">Submitted {formatDate(date)}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge status={status} />
        <button onClick={() => setOpen(true)} className="btn btn-ghost btn-sm px-2" title="View answers">
          <Eye className="h-4 w-4" />
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={title} subtitle={`Submitted ${formatDate(date)}`} size="xl">
        {children}
      </Modal>
    </li>
  );
}
