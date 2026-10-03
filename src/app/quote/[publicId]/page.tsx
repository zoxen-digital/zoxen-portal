import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { isExpired } from "@/lib/quotes";
import { Quote } from "@/models/Quote";
import { Invoice } from "@/models/Invoice";
import { QuoteDocument } from "@/components/QuoteDocument";
import { AcceptQuoteBox } from "@/components/QuoteForms";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { formatMoney, serialize } from "@/lib/utils";
import type { ClientT, QuoteT } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ publicId: string }> };

async function load(publicId: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(publicId)) return null;
  await dbConnect();
  return Quote.findOne({ publicId, status: { $ne: "Draft" } }).populate("client", "name company email phone").lean();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const doc = (await load(publicId)) as { number?: string } | null;
  const settings = await getSettings();
  return { title: { absolute: doc ? `Proposal ${doc.number} | ${settings.companyName}` : "Proposal not found" }, robots: { index: false, follow: false } };
}

export default async function PublicQuotePage({ params }: Props) {
  const { publicId } = await params;
  const doc = await load(publicId);
  if (!doc) notFound();

  // First view by the client (not the team previewing while logged in as staff).
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if ((!session || session.role === "client") && !(doc as { viewedAt?: Date }).viewedAt) {
    await Quote.updateOne({ publicId }, { $set: { viewedAt: new Date() } });
  }

  const quote = serialize<QuoteT>(doc);
  const settings = await getSettings();
  const expired = isExpired(quote);
  const invoice = quote.invoice ? await Invoice.findById(quote.invoice).select("publicId").lean<{ publicId: string }>() : null;

  return (
    <main className="paper min-h-screen bg-bg px-3 py-6 sm:px-6 sm:py-10">
      <div className="no-print mx-auto mb-4 flex max-w-[860px] justify-end">
        <DownloadPdfButton fileName={`Proposal-${quote.number}`} />
      </div>
      <QuoteDocument quote={quote} settings={settings} client={quote.client as ClientT | null} expired={expired} />
      {quote.status === "Sent" && !expired && <AcceptQuoteBox publicId={quote.publicId} total={formatMoney(quote.totals?.total, quote.currency)} />}
      {quote.status === "Accepted" && (
        <div className="no-print mx-auto mt-6 max-w-[860px] rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <h2 className="mt-2 text-lg font-bold text-heading">Thank you! Your project is starting.</h2>
          <p className="mt-1 text-sm text-muted">We have created your invoice and set up your project. Our team will be in touch shortly.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {invoice && (
              <Link href={`/invoice/${invoice.publicId}`} className="btn btn-primary">
                View invoice
              </Link>
            )}
            <Link href="/portal" className="btn btn-outline">
              Go to your portal
            </Link>
          </div>
        </div>
      )}
      {(expired || quote.status === "Expired") && (
        <p className="no-print mx-auto mt-6 max-w-[860px] rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-800">
          This proposal has expired. Please contact us for an updated quote.
        </p>
      )}
      {quote.status === "Declined" && (
        <p className="no-print mx-auto mt-6 max-w-[860px] rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">This proposal was declined.</p>
      )}
    </main>
  );
}
