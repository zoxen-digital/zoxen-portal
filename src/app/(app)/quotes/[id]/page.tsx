import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, FileText, Rocket } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/mailer";
import { isExpired } from "@/lib/quotes";
import { validId } from "@/lib/api";
import { Quote } from "@/models/Quote";
import { QuoteDocument } from "@/components/QuoteDocument";
import { QuoteActions } from "@/components/QuoteForms";
import { LocalTime } from "@/components/LocalTime";
import { serialize } from "@/lib/utils";
import type { ClientT, QuoteT } from "@/lib/types";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await pageUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) notFound();
  await dbConnect();
  const [doc, settings] = await Promise.all([Quote.findById(id).populate("client", "name company email phone").lean(), getSettings()]);
  if (!doc) notFound();
  const quote = serialize<QuoteT>(doc);
  const client = quote.client as ClientT | null;
  const link = appUrl(`/quote/${quote.publicId}`);

  return (
    <div className="space-y-6">
      <Link href="/quotes" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to quotes
      </Link>
      <div className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-muted">
          {quote.status === "Draft" && "Draft: only you can see it. Send it when ready."}
          {quote.status === "Sent" && (
            <>
              Sent {quote.sentAt && <LocalTime iso={quote.sentAt} />} ·{" "}
              {quote.viewedAt ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Eye className="h-3.5 w-3.5" /> Viewed <LocalTime iso={quote.viewedAt} />
                </span>
              ) : (
                "Not viewed yet"
              )}
            </>
          )}
          {quote.status === "Declined" && `Declined${quote.declineReason ? `: ${quote.declineReason}` : ""}`}
          {quote.status === "Accepted" && (
            <span className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-emerald-600">Accepted by {quote.acceptedName}</span>
              {quote.project && (
                <Link href={`/projects/${quote.project}`} className="btn btn-outline btn-sm">
                  <Rocket className="h-4 w-4" /> Project
                </Link>
              )}
              {quote.invoice && (
                <Link href={`/invoices/${quote.invoice}`} className="btn btn-outline btn-sm">
                  <FileText className="h-4 w-4" /> Invoice
                </Link>
              )}
            </span>
          )}
        </div>
        <QuoteActions quote={quote} link={link} />
      </div>
      <QuoteDocument quote={quote} settings={settings} client={client} expired={isExpired(quote)} />
    </div>
  );
}
