import Link from "next/link";
import { Users } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Invoice } from "@/models/Invoice";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
import { NewClientButton } from "@/components/ClientForm";
import { SearchBox, StatusTabs } from "@/components/Filters";
import { CLIENT_STATUSES } from "@/lib/constants";
import { escapeRegex, formatDate, formatMoney, serialize } from "@/lib/utils";
import type { ClientT } from "@/lib/types";

export const metadata = { title: "Clients" };

type SP = Promise<{ q?: string; status?: string; new?: string }>;

export default async function ClientsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await dbConnect();
  const settings = await getSettings();

  const filter: Record<string, unknown> = {};
  if (sp.status) filter.status = sp.status;
  if (sp.q) {
    const rx = { $regex: escapeRegex(sp.q), $options: "i" };
    filter.$or = [{ name: rx }, { company: rx }, { email: rx }, { phone: rx }, { website: rx }];
  }

  const [docs, statusAgg, queryAgg, invoiceAgg] = await Promise.all([
    Client.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
    Client.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Query.aggregate([
      {
        $group: {
          _id: "$client",
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ["$status", ["Pending", "In Progress"]] }, 1, 0] } },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { status: { $nin: ["Draft", "Cancelled"] } } },
      { $group: { _id: "$client", total: { $sum: "$totals.total" }, balance: { $sum: "$totals.balance" } } },
    ]),
  ]);

  const clients = serialize<ClientT[]>(docs);
  const qMap = new Map(queryAgg.map((q: { _id: unknown; total: number; open: number }) => [String(q._id), q]));
  const iMap = new Map(invoiceAgg.map((i: { _id: unknown; total: number; balance: number }) => [String(i._id), i]));
  const counts: Record<string, number> = { All: 0 };
  for (const s of statusAgg as { _id: string; n: number }[]) {
    counts[s._id] = s.n;
    counts.All! += s.n;
  }
  const cur = settings.defaultCurrency;

  return (
    <div>
      <PageHeader title="Clients" subtitle="Everyone you work with, their projects and what they owe.">
        <NewClientButton autoOpen={sp.new === "1"} />
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusTabs basePath="/clients" current={sp.status} options={[...CLIENT_STATUSES]} params={sp} counts={counts} />
        <SearchBox action="/clients" defaultValue={sp.q} placeholder="Search name, company, email..." hidden={{ status: sp.status }} />
      </div>

      <div className="card overflow-hidden">
        {clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={sp.q || sp.status ? "No clients match your filters" : "No clients yet"}
            text={sp.q || sp.status ? "Try a different search or status." : "Add your first client to start tracking queries and invoices."}
          />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Queries</th>
                  <th>Invoiced</th>
                  <th>Balance</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const q = qMap.get(c._id);
                  const inv = iMap.get(c._id);
                  return (
                    <tr key={c._id}>
                      <td>
                        <Link href={`/clients/${c._id}`} className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-heading hover:text-brand">{c.name}</div>
                            <div className="truncate text-xs text-muted">{c.company || c.website || "—"}</div>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <div className="text-fg">{c.email || "—"}</div>
                        <div className="text-xs text-muted">{c.phone}</div>
                      </td>
                      <td className="whitespace-nowrap text-muted">{c.source}</td>
                      <td>
                        <Badge status={c.status} />
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="font-semibold text-heading">{q?.total || 0}</span>
                        {q?.open ? <span className="ml-1 text-xs text-amber-600">({q.open} open)</span> : null}
                      </td>
                      <td className="whitespace-nowrap font-semibold text-heading">{formatMoney(inv?.total || 0, cur)}</td>
                      <td className={`whitespace-nowrap font-semibold ${inv?.balance ? "text-red-500" : "text-muted"}`}>
                        {formatMoney(inv?.balance || 0, cur)}
                      </td>
                      <td className="whitespace-nowrap text-muted">{formatDate(c.createdAt)}</td>
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
