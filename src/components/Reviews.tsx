"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PenLine, Pin, PinOff, Star, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { DeleteButton } from "./actions";
import { useDialogs } from "./Dialogs";

export function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size, n <= value ? "fill-amber-400 text-amber-400" : "text-line")} />
      ))}
    </span>
  );
}

/** Client: write a review (goes to the team for approval). */
export function WriteReviewButton({ defaultName, defaultCompany }: { defaultName: string; defaultCompany: string }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState(defaultName);
  const [company, setCompany] = useState(defaultCompany);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/portal/reviews", "POST", { rating, text, name, company });
      notify("Thank you! Your review will appear once our team approves it.");
      setOpen(false);
      setText("");
      router.refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <PenLine className="h-4 w-4" /> Write a review
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Share your experience" subtitle="Your review is shown to other clients after our team approves it.">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <span className="label">Your rating</span>
            <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} stars`}>
                  <Star className={cn("h-8 w-8 transition", (hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-line")} />
                </button>
              ))}
            </div>
          </div>
          <Field label="Your review *">
            <textarea
              className="input"
              rows={5}
              required
              minLength={10}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="How was working with us? What did you like? Would you recommend us?"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name shown">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </Field>
            <Field label="Business shown (optional)">
              <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy || text.trim().length < 10}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit review
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Admin: approve / reject / pin / delete one review. */
export function ReviewAdminActions({ id, status, featured }: { id: string; status: string; featured?: boolean }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState("");

  async function act(action: string, msg: string) {
    setBusy(action);
    try {
      await api(`/api/reviews/${id}`, "PUT", { action });
      notify(msg);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "Approved" && (
        <button onClick={() => act("approve", "Review approved. All clients can see it now.")} disabled={!!busy} className="btn btn-primary btn-sm">
          {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
        </button>
      )}
      {status !== "Rejected" && (
        <button onClick={() => act("reject", status === "Approved" ? "Review hidden" : "Review rejected")} disabled={!!busy} className="btn btn-outline btn-sm">
          <X className="h-3.5 w-3.5" /> {status === "Approved" ? "Hide" : "Reject"}
        </button>
      )}
      {status === "Approved" && (
        <button onClick={() => act(featured ? "unfeature" : "feature", featured ? "Unpinned" : "Pinned to the top")} disabled={!!busy} className="btn btn-ghost btn-sm" title={featured ? "Unpin" : "Pin to top"}>
          {featured ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {featured ? "Unpin" : "Pin"}
        </button>
      )}
      <DeleteButton small url={`/api/reviews/${id}`} confirmText="Delete this review permanently?" />
    </div>
  );
}
