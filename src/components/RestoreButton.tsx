"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { api } from "@/lib/client-api";
import { useDialogs } from "./Dialogs";

export function RestoreButton({ batch, label, count }: { batch: string; label: string; count: number }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [busy, setBusy] = useState(false);

  async function restore() {
    const ok = await confirm({
      title: `Restore "${label}"?`,
      message: count > 1 ? `Everything deleted with it (${count} items) is restored too.` : "It comes back exactly as it was when deleted.",
      confirmText: "Restore",
      tone: "success",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api<{ restored: number }>(`/api/agent/trash/${batch}`, "POST");
      notify(r.restored ? `Restored ${r.restored} item${r.restored === 1 ? "" : "s"}` : "Already back in place, nothing to restore");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={restore} disabled={busy} className="btn btn-outline btn-sm">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Restore
    </button>
  );
}
