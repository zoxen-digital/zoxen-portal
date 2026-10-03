"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { api } from "@/lib/client-api";
import { useDialogs } from "./Dialogs";
import { DownloadPdfButton } from "./DownloadPdfButton";

/** Month picker + PDF (+ send to client on the admin side). */
export function ReportControls({ basePath, month, sendUrl, fileName }: { basePath: string; month: string; sendUrl?: string; fileName: string }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const r = await api<{ via: string }>(sendUrl!, "POST", { month });
      notify(r.via === "portal" ? "Report sent to the client's portal, phone and email" : "Report emailed to the client");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-2">
      <input
        type="month"
        className="input w-auto"
        value={month}
        max={new Date().toISOString().slice(0, 7)}
        onChange={(e) => e.target.value && router.push(`${basePath}${basePath.includes("?") ? "&" : "?"}month=${e.target.value}`)}
      />
      <div className="flex gap-2">
        <DownloadPdfButton fileName={fileName} />
        {sendUrl && (
          <button onClick={send} disabled={busy} className="btn btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to client
          </button>
        )}
      </div>
    </div>
  );
}
