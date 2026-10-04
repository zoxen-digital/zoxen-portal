import Link from "next/link";
import { Gift, Handshake, Trophy, UserPlus } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Referral } from "@/models/Referral";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { StatusTabs } from "@/components/Filters";
import { ReferralActions } from "@/components/ReferralActions";
import { formatDate, serialize } from "@/lib/utils";
import type { ClientT, ReferralT } from "@/lib/types";

export const metadata = { title: "Referrals" };

const STATUSES = ["Submitted", "Converted", "Rewarded", "Not converted"];
const LABEL: Record<string, string> = { Submitted: "Form submitted", Converted: "Reward due", Rewarded: "Rewarded", "Not converted": "Not converted" };

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageUser(ADMIN);
  const sp = await searchParams;
  await dbConnect();
  const [docs, all, settings] = await Promise.all([
    Referral.find(sp.status ? { status: sp.status } : {}).sort({ createdAt: -1 }).limit(500).populate("referrer", "name company").populate("newClient", "name company").lean(),
    Referral.find().select("status").lean<{ status: string }[]>(),
    getSettings(),
  ]);
  const items = serialize<ReferralT[]>(docs);
  const counts: Record<string, number> = { All: all.length };
  for (const r of all) counts[r.status] = (counts[r.status] || 0) + 1;

  return (
    <div>
      <PageHeader
        title="Referrals"
        subtitle="Clients share their link from the portal. When a referred form is approved, the reward becomes due; give it, then mark it rewarded."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={UserPlus} label="Referred leads" value={all.length} tone="blue" />
        <StatCard icon={Handshake} label="Became clients" value={(counts.Converted || 0) + (counts.Rewarded || 0)} tone="green" />
        <StatCard icon={Gift} label="Rewards due" value={counts.Converted || 0} tone={counts.Converted ? "amber" : "slate"} href="/referrals?status=Converted" />
        <StatCard icon={Trophy} label="Rewards given" value={counts.Rewarded || 0} tone="violet" />
      </div>
      <div className="mb-4 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-muted">
        Reward shown to clients: <b className="text-heading">{settings.referralReward || "Not set"}</b> ·{" "}
        <Link href="/settings" className="font-semibold text-brand hover:underline dark:text-[#8f9bff]">Change in Settings</Link>
      </div>
      <div className="mb-4">
        <StatusTabs basePath="/referrals" current={sp.status} options={STATUSES} params={sp} counts={counts} />
      </div>
      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={Gift} title="No referrals yet" text="Clients find their referral link under Refer & Earn in their portal." />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Referred by</th>
                  <th>New lead</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Reward</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const by = r.referrer as ClientT | null;
                  const nc = r.newClient as ClientT | null;
                  const byName = by ? by.company || by.name : "Deleted client";
                  return (
                    <tr key={r._id}>
                      <td>
                        {by ? (
                          <Link href={`/clients/${by._id}`} className="font-semibold text-heading hover:text-brand">{byName}</Link>
                        ) : (
                          <span className="text-muted">{byName}</span>
                        )}
                      </td>
                      <td>
                        <div className="font-medium text-heading">{r.leadCompany || r.leadName}</div>
                        <div className="text-xs text-muted">
                          {nc ? (
                            <Link href={`/clients/${nc._id}`} className="hover:text-brand">Client: {nc.company || nc.name}</Link>
                          ) : (
                            <Link href={`/submissions?open=${r.onboarding}`} className="hover:text-brand">View form</Link>
                          )}
                        </div>
                      </td>
                      <td><Badge status={LABEL[r.status] || r.status} /></td>
                      <td className="whitespace-nowrap text-muted">{formatDate(r.convertedAt || r.createdAt)}</td>
                      <td className="max-w-[240px] text-xs text-muted">{r.rewardNote ? `${r.rewardNote} (${formatDate(r.rewardedAt)})` : "—"}</td>
                      <td>
                        <div className="flex justify-end">
                          <ReferralActions id={r._id} status={r.status} defaultNote={settings.referralReward || ""} referrer={byName} />
                        </div>
                      </td>
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
