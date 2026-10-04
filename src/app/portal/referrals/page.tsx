import { Gift, Handshake, Send, Trophy } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/mailer";
import { referralCodeFor } from "@/lib/referrals";
import { Referral } from "@/models/Referral";
import { Badge, EmptyState } from "@/components/ui";
import { CopyButton } from "@/components/actions";
import { formatDate, serialize } from "@/lib/utils";
import type { ReferralT } from "@/lib/types";

export const metadata = { title: "Refer & Earn" };

const LABEL: Record<string, string> = { Submitted: "Form submitted", Converted: "Project started", Rewarded: "Rewarded", "Not converted": "Not converted" };

export default async function PortalReferrals() {
  const user = await pageUser(["client"]);
  await dbConnect();
  const [code, settings, docs] = await Promise.all([
    referralCodeFor(user.clientId!),
    getSettings(),
    Referral.find({ referrer: user.clientId }).sort({ createdAt: -1 }).lean(),
  ]);
  const items = serialize<ReferralT[]>(docs);
  const link = appUrl(`/onboarding?ref=${code}`);
  const started = items.filter((r) => r.status === "Converted" || r.status === "Rewarded").length;
  const message = `I worked with ${settings.companyName} on my project and was really happy. If you need a website or digital marketing, start here: ${link}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[28px]">Refer & Earn</h1>
        <p className="mt-1 text-sm text-muted">Know someone who needs a website or marketing? Share your link.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-brand-gradient p-6 text-white">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <div className="text-lg font-bold">Your reward</div>
              <p className="mt-1 text-sm text-white/90">{settings.referralReward || "Ask us about our referral rewards."}</p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <span className="label">Your personal referral link</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="input font-mono text-xs" readOnly value={link} />
              <CopyButton text={link} />
              <a className="btn btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>
                <Send className="h-4 w-4" /> Share on WhatsApp
              </a>
            </div>
          </div>
          <ol className="grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["1", "Share your link", "Send it to a friend or business owner."],
              ["2", "They fill our form", "Their onboarding form comes to us through your link."],
              ["3", "You get rewarded", "When their project starts, your reward is on us."],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-xl bg-surface-2 p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">{n}</span>
                <div className="mt-2 font-semibold text-heading">{t}</div>
                <div className="text-xs text-muted">{d}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-heading">{items.length}</div>
          <div className="text-xs text-muted">Referred</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-2xl font-bold text-heading">
            <Handshake className="h-5 w-5 text-emerald-500" /> {started}
          </div>
          <div className="text-xs text-muted">Started a project</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-2xl font-bold text-heading">
            <Trophy className="h-5 w-5 text-amber-500" /> {items.filter((r) => r.status === "Rewarded").length}
          </div>
          <div className="text-xs text-muted">Rewards received</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line p-4 font-bold text-heading">Your referrals</div>
        {items.length === 0 ? (
          <EmptyState icon={Gift} title="No referrals yet" text="Share your link; every friend who fills our form shows up here." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((r) => (
              <li key={r._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-heading">{r.leadCompany || r.leadName}</div>
                  <div className="text-xs text-muted">Referred {formatDate(r.createdAt)}</div>
                  {r.rewardNote && <div className="mt-1 text-xs font-semibold text-emerald-600">Reward: {r.rewardNote}</div>}
                </div>
                <Badge status={LABEL[r.status] || r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
