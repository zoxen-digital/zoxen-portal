"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Undo2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";

/** "Mark rewarded" (with what was given) or undo, for one referral. */
export function ReferralActions({ id, status, defaultNote, referrer }: { id: string; status: string; defaultNote: string; referrer: string }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(defaultNote);
  const [busy, setBusy] = useState(false);

  async function reward(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/referrals/${id}`, "PUT", { action: "reward", note });
      notify(`Marked rewarded. ${referrer} was notified.`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!(await confirm({ title: "Undo this reward?", message: "It goes back to 'reward due'. The client is not notified.", confirmText: "Undo" }))) return;
    try {
      await api(`/api/referrals/${id}`, "PUT", { action: "undo" });
      router.refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    }
  }

  if (status === "Rewarded") {
    return (
      <button onClick={undo} className="btn btn-ghost btn-sm" title="Undo reward">
        <Undo2 className="h-4 w-4" />
      </button>
    );
  }
  if (status !== "Converted") return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
        <Gift className="h-3.5 w-3.5" /> Mark rewarded
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Give the referral reward" subtitle={`For ${referrer}. They get a notification with this note.`}>
        <form onSubmit={reward} className="space-y-4">
          <Field label="What did you give? *">
            <textarea className="input" rows={3} required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 10% off applied to invoice ZD-2026-014" />
          </Field>
          <p className="text-xs text-muted">Nothing is charged or discounted automatically. Apply the discount on their next invoice yourself, then save this.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Mark rewarded
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
