"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellPlus, Loader2, Send } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";

const TEMPLATES = [
  {
    key: "follow-up",
    label: "General follow-up",
    title: "Quick follow-up from our team",
    message: "Just checking in on your project. Is there anything you need from us, or any questions we can help with?",
  },
  {
    key: "content",
    label: "Content / files needed",
    title: "We need a few things from you",
    message:
      "To keep your project on schedule, please send us the remaining content (text, images, logo or login details) at your earliest convenience. Reply to this message or share the files with your project manager.",
  },
  {
    key: "review",
    label: "Review reminder",
    title: "Your review is waiting",
    message: "Your project is ready for your review. Please take a look in your portal and approve it or request changes, so we can move to the next step.",
  },
  {
    key: "meeting",
    label: "Meeting reminder",
    title: "Reminder: our upcoming meeting",
    message: "A friendly reminder about our upcoming meeting. You can find the date, time and joining link in your portal.",
  },
  {
    key: "payment",
    label: "Payment follow-up",
    title: "Payment follow-up",
    message: "A friendly reminder about your outstanding invoice. You can view and pay it from the Invoices section of your portal. If you have already paid, please ignore this message.",
  },
  {
    key: "thanks",
    label: "Thank you / check-in",
    title: "Thank you for working with us",
    message: "Thank you for trusting us with your project. If you need any updates, support or new services, we are always here to help.",
  },
  { key: "custom", label: "Write my own", title: "", message: "" },
];

/** Sends a custom notification to a client (bell + phone push + email). */
export function FollowUpButton({ url, clientName, outline = true, label = "Send follow-up" }: { url: string; clientName?: string; outline?: boolean; label?: string }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState(TEMPLATES[0]!.key);
  const [title, setTitle] = useState(TEMPLATES[0]!.title);
  const [message, setMessage] = useState(TEMPLATES[0]!.message);
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);

  function pick(key: string) {
    const t = TEMPLATES.find((x) => x.key === key)!;
    setTpl(key);
    setTitle(t.title);
    setMessage(t.message);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ via: string }>(url, "POST", { title, message, email });
      notify(res.via === "portal" ? "Sent to the client's portal and phone" + (email ? " and email" : "") : "Emailed to the client (no portal login yet)");
      setOpen(false);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={outline ? "btn btn-outline" : "btn btn-primary"}>
        <BellPlus className="h-4 w-4" /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Send follow-up" subtitle={clientName ? `To ${clientName}: portal notification, phone alert and email` : undefined} size="lg">
        <form onSubmit={send} className="space-y-4">
          <div>
            <span className="label">Template</span>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  type="button"
                  key={t.key}
                  onClick={() => pick(t.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    tpl === t.key ? "border-brand bg-brand/10 text-brand dark:text-[#8f9bff]" : "border-line text-muted hover:bg-surface-2"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Subject *">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Message *">
            <textarea className="input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={2000} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Also send by email
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
