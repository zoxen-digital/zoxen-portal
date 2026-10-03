"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquarePlus, Star } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";
import { useDialogs } from "./Dialogs";

export function ReviewActions({
  projectId,
  canApprove,
  canRequest,
  roundsUsed,
  limit,
}: {
  projectId: string;
  canApprove: boolean;
  canRequest: boolean;
  roundsUsed: number;
  limit: number;
}) {
  const router = useRouter();
  const { confirm, notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [links, setLinks] = useState("");
  const nextIsExtra = limit > 0 && roundsUsed + 1 > limit;

  async function approve() {
    const ok = await confirm({
      title: "Approve this work?",
      message: "This tells our team everything looks good, and we will move ahead with the launch / final delivery.",
      confirmText: "Yes, approve",
      tone: "success",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/portal/projects/${projectId}/approve`, "POST");
      notify("Approved. Thank you! Our team has been notified.");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/portal/projects/${projectId}/revision`, "POST", { request, links });
      setOpen(false);
      setRequest("");
      setLinks("");
      notify("Your changes were sent to the team.");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!canApprove && !canRequest) return null;
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        {canApprove && (
          <button onClick={approve} disabled={busy} className="btn bg-emerald-500 text-white hover:bg-emerald-600">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
          </button>
        )}
        {canRequest && (
          <button onClick={() => setOpen(true)} disabled={busy} className="btn btn-outline">
            <MessageSquarePlus className="h-4 w-4" /> Request changes
          </button>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Request changes" subtitle={limit ? `Round ${roundsUsed + 1} · ${limit} included in your package` : `Round ${roundsUsed + 1}`}>
        <form onSubmit={submit} className="space-y-4">
          {nextIsExtra && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              This is beyond the {limit} revision round{limit > 1 ? "s" : ""} included in your package. Our team will confirm any extra cost before starting.
            </p>
          )}
          <div>
            <label className="label" htmlFor="req">What would you like changed? *</label>
            <textarea
              id="req"
              className="input"
              rows={6}
              required
              minLength={5}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder={"Please list each change clearly, e.g.\n1. Homepage: change the main heading to ...\n2. Contact page: add our second phone number"}
            />
          </div>
          <div>
            <label className="label" htmlFor="links">Links or screenshots (optional)</label>
            <input id="links" className="input" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="Google Drive / Loom / image links" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send to team
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function FeedbackForm({ projectId, initial }: { projectId: string; initial?: { rating?: number; comment?: string } }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [rating, setRating] = useState(initial?.rating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initial?.comment || "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/portal/projects/${projectId}/feedback`, "POST", { rating, comment });
      notify("Thank you for your feedback!");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
            <Star className={cn("h-7 w-7 transition", (hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-line")} />
          </button>
        ))}
      </div>
      <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was working with us? Anything we can do better?" />
      <button className="btn btn-primary" disabled={busy || !rating}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {initial?.rating ? "Update feedback" : "Send feedback"}
      </button>
    </form>
  );
}
