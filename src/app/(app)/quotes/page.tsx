import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { isExpired } from "@/lib/quotes";
import { Quote } from "@/models/Quote";
import { Client } from "@/models/Client";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { DealTabs } from "@/components/DealTabs";
import { SearchBox, StatusTabs } from "@/components/Filters";
import { QUOTE_STATUSES } from "@/lib/constants";
import { escapeRegex, formatDate, formatMoney, serialize } from "@/lib/utils";
import type { ClientT, QuoteT } from "@/lib/types";

export const metadata = { title: "Quotes" };

type SP = Promise<{ q?: string; status?: string }>;

export default async function QuotesPage({ searchParams }: { searchParams: SP }) {
  await pageUser(ADMIN);
  const sp = await searchParams;
  await dbConnect();
  const filter: Record<string, unknown> = {};
  if (sp.status) filter.status = sp.status;
  if (sp.q) {
    const rx = { $regex: escapeRegex(sp.q), $options: "i" };
    const matching = await Client.find({ $or: [{ name: rx }, { company: rx }] }).select("_id").lean();
    filter.$or = [{ title: rx }, { number: rx }, { client: { $in: matching.map((c) => c._id) } }];
  }
  const [docs, all] = await Promise.all([
    Quote.find(filter).sort({ createdAt: -1 }).limit(500).populate("client", "name company").lean(),
    Quote.find().select("status totals currency").lean<{ status: string; totals?: { total?: number }; currency: string }[]>(),
  ]);
  const quotes = serialize<QuoteT[]>(docs);
  const counts: Record<string, number> = { All: all.length };
  for (const q of all) counts[q.status] = (counts[q.status] || 0) + 1;
  const decided = (counts.Accepted || 0) + (counts.Declined || 0);
  const winRate = decided ? Math.round(((counts.Accepted || 0) / decided) * 100) : 0;

  return (
    <div>
      <DealTabs current="quotes" />
      <PageHeader title="Quotes" subtitle="Price offers. The client accepts online, and accepting creates the project and the invoice automatically.">
        <Link href="/quotes/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> New quote
        </Link>
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={FileSignature} label="Waiting on client" value={counts.Sent || 0} tone="blue" href="/quotes?status=Sent" />
        <StatCard icon={FileSignature} label="Accepted" value={counts.Accepted || 0} tone="green" href="/quotes?status=Accepted" />
        <StatCard icon={FileSignature} label="Declined / expired" value={(counts.Declined || 0) + (counts.Expired || 0)} tone="red" href="/quotes?status=Declined" />
        <StatCard icon={FileSignature} label="Win rate" value={decided ? `${winRate}%` : "—"} tone="violet" />
      </div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs basePath="/quotes" current={sp.status} options={[...QUOTE_STATUSES]} params={sp} counts={counts} />
        <SearchBox action="/quotes" defaultValue={sp.q} placeholder="Search quote or client..." hidden={{ status: sp.status }} />
      </div>
      <div className="card overflow-hidden">
        {quotes.length === 0 ? (
          <EmptyState icon={FileSignature} title="No quotes yet" text="Create a quote, or start one from a package on the client page." />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Client</th>
                  <th>Total</th>
                  <th>Valid until</th>
                  <th>Status</th>
                  <th>Viewed</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const c = q.client as ClientT | null;
                  return (
                    <tr key={q._id}>
                      <td>
                        <Link href={`/quotes/${q._id}`} className="group block min-w-[200px]">
                          <div className="text-xs font-semibold text-muted">{q.number}</div>
                          <div className="font-semibold text-heading group-hover:text-brand">{q.title}</div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-muted">{c ? c.company || c.name : "—"}</td>
                      <td className="whitespace-nowrap font-semibold text-heading">{formatMoney(q.totals?.total, q.currency)}</td>
                      <td className="whitespace-nowrap text-muted">{formatDate(q.validUntil)}</td>
                      <td><Badge status={isExpired(q) ? "Expired" : q.status} /></td>
                      <td className="whitespace-nowrap text-xs text-muted">{q.viewedAt ? formatDate(q.viewedAt) : "Not yet"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
