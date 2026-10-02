"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Printer } from "lucide-react";
import { useDialogs } from "@/components/Dialogs";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";

export function PublicInvoiceActions({
  publicId,
  invoiceNumber,
  confirmed,
  paid,
  hasPaymentDetails,
}: {
  publicId: string;
  invoiceNumber: string;
  confirmed: boolean;
  paid: boolean;
  hasPaymentDetails: boolean;
}) {
  const { confirm: ask, notify } = useDialogs();
  const [done, setDone] = useState(confirmed);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const ok = await ask({
      title: "Confirm this invoice?",
      message: "This lets our team know you have reviewed the invoice and will proceed with the payment.",
      confirmText: "Yes, confirm",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/invoices/${publicId}/confirm`, { method: "POST" });
      if (!res.ok) throw new Error();
      setDone(true);
      notify("Thank you! Your invoice is confirmed.");
    } catch {
      notify("Could not confirm right now. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print mx-auto mt-5 max-w-[860px] space-y-3">
      {done && !paid && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-bold">Thank you, your invoice is confirmed.</div>
            <div>
              {hasPaymentDetails
                ? "Please transfer the balance using the payment details above and share the receipt with our team."
                : "Our team will contact you shortly with payment instructions."}
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <DownloadPdfButton fileName={`Invoice-${invoiceNumber}`} className="h-12" />
        <button onClick={() => window.print()} className="btn btn-outline h-12">
          <Printer className="h-4 w-4" /> Print Invoice
        </button>
        {paid ? (
          <div className="btn h-12 cursor-default bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-4 w-4" /> Paid in full
          </div>
        ) : done ? (
          <div className="btn h-12 cursor-default bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-4 w-4" /> Confirmed
          </div>
        ) : (
          <button onClick={confirm} disabled={busy} className="btn btn-primary h-12">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm & Pay <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
