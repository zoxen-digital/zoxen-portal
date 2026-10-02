import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { Invoice } from "@/models/Invoice";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PublicInvoiceActions } from "./PublicInvoiceActions";
import { serialize } from "@/lib/utils";
import type { InvoiceT } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ publicId: string }> };

async function load(publicId: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(publicId)) return null;
  await dbConnect();
  return Invoice.findOne({ publicId, status: { $nin: ["Draft", "Cancelled"] } }).lean();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const doc = (await load(publicId)) as { invoiceNumber?: string } | null;
  const settings = await getSettings();
  return {
    title: { absolute: doc ? `Invoice ${doc.invoiceNumber} | ${settings.companyName}` : "Invoice not found" },
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvoicePage({ params }: Props) {
  const { publicId } = await params;
  const doc = await load(publicId);
  if (!doc) notFound();

  // Count client views, but not when the team previews it while logged in.
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    await Invoice.updateOne({ publicId }, { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } });
  }

  const invoice = serialize<InvoiceT>(doc);
  const settings = await getSettings();

  return (
    <main className="paper relative min-h-screen overflow-hidden bg-bg px-3 py-6 sm:px-6 sm:py-10">
      <svg className="no-print pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="pg" x1="0" x2="1">
            <stop offset="0%" stopColor="#2639E8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6C3BF5" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <ellipse cx="5%" cy="30%" rx="300" ry="420" fill="none" stroke="url(#pg)" />
        <ellipse cx="98%" cy="10%" rx="260" ry="160" fill="none" stroke="url(#pg)" />
        <circle cx="96%" cy="55%" r="10" fill="#6C3BF5" fillOpacity="0.5" />
      </svg>

      <div className="relative mx-auto max-w-[860px]">
        <InvoiceDocument invoice={invoice} settings={settings} />
        <PublicInvoiceActions
          publicId={invoice.publicId}
          invoiceNumber={invoice.invoiceNumber}
          confirmed={!!invoice.confirmedAt}
          paid={invoice.totals.balance <= 0}
          hasPaymentDetails={!!(invoice.paymentDetails?.accountNumber || invoice.paymentDetails?.iban || invoice.paymentDetails?.other)}
        />
        <p className="no-print mt-6 text-center text-xs text-muted">
          Questions about this invoice? Contact {settings.companyName}
          {settings.phone ? ` at ${settings.phone}` : ""}
          {settings.email ? ` or ${settings.email}` : ""}.
        </p>
      </div>
    </main>
  );
}
