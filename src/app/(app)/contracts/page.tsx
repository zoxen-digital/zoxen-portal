import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { Contract } from "@/models/Contract";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { DealTabs } from "@/components/DealTabs";
import { StatusTabs } from "@/components/Filters";
import { CONTRACT_STATUSES } from "@/lib/constants";
import { formatDate, serialize } from "@/lib/utils";
import type { ClientT, ContractT } from "@/lib/types";

export const metadata = { title: "Contracts" };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageUser(ADMIN);
  const sp = await searchParams;
  await dbConnect();
  const [docs, all] = await Promise.all([
    Contract.find(sp.status ? { status: sp.status } : {}).sort({ createdAt: -1 }).limit(500).populate("client", "name company").lean(),
    Contract.find().select("status").lean<{ status: string }[]>(),
  ]);
  const contracts = serialize<ContractT[]>(docs);
  const counts: Record<string, number> = { All: all.length };
  for (const c of all) counts[c.status] = (counts[c.status] || 0) + 1;

  return (
    <div>
      <DealTabs current="contracts" />
      <PageHeader title="Contracts" subtitle="Agreements clients sign online. Name, date, time and IP are recorded as proof.">
        <Link href="/contracts/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> New contract
        </Link>
      </PageHeader>
      <div className="mb-4">
        <StatusTabs basePath="/contracts" current={sp.status} options={[...CONTRACT_STATUSES]} params={sp} counts={counts} />
      </div>
      <div className="card overflow-hidden">
        {contracts.length === 0 ? (
          <EmptyState icon={FileSignature} title="No contracts yet" text="Create one for a client; the text starts from your template in Settings." />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Signed</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const cl = c.client as ClientT | null;
                  return (
                    <tr key={c._id}>
                      <td>
                        <Link href={`/contracts/${c._id}`} className="group block min-w-[200px]">
                          <div className="text-xs font-semibold text-muted">{c.number}</div>
                          <div className="font-semibold text-heading group-hover:text-brand">{c.title}</div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-muted">{cl ? cl.company || cl.name : "—"}</td>
                      <td><Badge status={c.status} /></td>
                      <td className="whitespace-nowrap text-muted">{formatDate(c.sentAt)}</td>
                      <td className="whitespace-nowrap text-muted">{c.signedAt ? `${formatDate(c.signedAt)} · ${c.signedName}` : "—"}</td>
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
