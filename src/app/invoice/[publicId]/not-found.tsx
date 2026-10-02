import { FileX } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function InvoiceNotFound() {
  return (
    <main className="paper flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <Logo className="mb-6 justify-center" />
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <FileX className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-heading">Invoice not available</h1>
        <p className="mt-2 text-sm text-muted">This invoice link is invalid, was cancelled, or has not been issued yet. Please contact our team for an updated link.</p>
      </div>
    </main>
  );
}
