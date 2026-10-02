"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDialogs } from "./Dialogs";

export function DownloadPdfButton({ fileName, className, label = "Download PDF" }: { fileName: string; className?: string; label?: string }) {
  const { notify } = useDialogs();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const { downloadInvoicePdf } = await import("@/lib/pdf");
      await downloadInvoicePdf(fileName);
      notify("PDF downloaded");
    } catch (e) {
      console.error(e);
      notify("Could not create the PDF. Please try again, or use Print.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={run} disabled={busy} className={cn("btn btn-outline", className)}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "Preparing PDF..." : label}
    </button>
  );
}
