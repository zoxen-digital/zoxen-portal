"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { useDialogs } from "./Dialogs";

export function DeleteButton({
  url,
  confirmText,
  redirectTo,
  label,
  small,
}: {
  url: string;
  confirmText: string;
  redirectTo?: string;
  label?: string;
  small?: boolean;
}) {
  const router = useRouter();
  const { confirm, notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  async function run() {
    const ok = await confirm({ title: "Are you sure?", message: confirmText, confirmText: "Yes, delete", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await api(url, "DELETE");
      notify("Deleted successfully");
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={run} disabled={busy} className={cn("btn btn-danger", small && "btn-sm px-2")} title="Delete">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {label}
    </button>
  );
}

/** Inline status dropdown that saves immediately. */
export function StatusSelect({
  url,
  value,
  options,
  field = "status",
  method = "PUT",
}: {
  url: string;
  value: string;
  options: readonly string[];
  field?: string;
  method?: string;
}) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  async function change(next: string) {
    const prev = v;
    setV(next);
    setBusy(true);
    try {
      await api(url, method, { [field]: next });
      notify(`Status changed to ${next}`);
      router.refresh();
    } catch (e) {
      setV(prev);
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <select
      className="input h-8 w-auto min-w-[130px] rounded-lg py-0 text-xs font-semibold"
      value={v}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

export function CopyButton({ text, label = "Copy link", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const { notify } = useDialogs();
  async function copy() {
    const value = text.startsWith("/") ? window.location.origin + text : text;
    try {
      await navigator.clipboard.writeText(value);
      notify("Link copied to clipboard");
    } catch {
      notify("Could not copy automatically. Select the link and copy it manually.", "error");
      return;
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button onClick={copy} className={cn("btn btn-outline", className)}>
      {done ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      {done ? "Copied!" : label}
    </button>
  );
}
