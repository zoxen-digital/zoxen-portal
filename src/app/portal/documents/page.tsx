import Link from "next/link";
import { ExternalLink, FileSignature, FileText } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { isExpired } from "@/lib/quotes";
import { Quote } from "@/models/Quote";
import { Contract } from "@/models/Contract";
import { Badge, EmptyState } from "@/components/ui";
import { formatDate, formatMoney, serialize } from "@/lib/utils";
import type { ContractT, QuoteT } from "@/lib/types";

export const metadata = { title: "Proposals & agreements" };

export default async function PortalDocuments() {
  const user = await pageUser(["client"]);
  await dbConnect();
  const [quoteDocs, contractDocs] = await Promise.all([
    Quote.find({ client: user.clientId, status: { $ne: "Draft" } }).sort({ createdAt: -1 }).lean(),
    Contract.find({ client: user.clientId, status: { $in: ["Sent", "Signed"] } }).sort({ createdAt: -1 }).lean(),
  ]);
  const quotes = serialize<QuoteT[]>(quoteDocs);
  const contracts = serialize<ContractT[]>(contractDocs);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[28px]">Proposals & agreements</h1>
        <p className="mt-1 text-sm text-muted">Review proposals, accept online, and sign agreements. Signed copies stay here.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line p-4 font-bold text-heading">
          <FileText className="h-5 w-5 text-brand dark:text-[#8f9bff]" /> Proposals
        </div>
        {quotes.length === 0 ? (
          <EmptyState icon={FileText} title="No proposals yet" />
        ) : (
          <ul className="divide-y divide-line">
            {quotes.map((q) => {
              const status = isExpired(q) ? "Expired" : q.status;
              return (
                <li key={q._id}>
                  <Link href={`/quote/${q.publicId}`} target="_blank" className="flex flex-col gap-2 p-4 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-semibold text-muted">
                        {q.number} · {formatDate(q.sentAt || q.createdAt)}
                      </div>
                      <div className="font-semibold text-heading">{q.title}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-heading">{formatMoney(q.totals?.total, q.currency)}</span>
                      <Badge status={status === "Sent" ? "Waiting on Client" : status} />
                      <ExternalLink className="h-4 w-4 text-muted" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line p-4 font-bold text-heading">
          <FileSignature className="h-5 w-5 text-brand dark:text-[#8f9bff]" /> Agreements
        </div>
        {contracts.length === 0 ? (
          <EmptyState icon={FileSignature} title="No agreements yet" />
        ) : (
          <ul className="divide-y divide-line">
            {contracts.map((c) => (
              <li key={c._id}>
                <Link href={`/contract/${c.publicId}`} target="_blank" className="flex flex-col gap-2 p-4 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold text-muted">
                      {c.number}
                      {c.signedAt ? ` · signed ${formatDate(c.signedAt)}` : ""}
                    </div>
                    <div className="font-semibold text-heading">{c.title}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge status={c.status === "Sent" ? "Waiting on Client" : c.status} />
                    <ExternalLink className="h-4 w-4 text-muted" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
