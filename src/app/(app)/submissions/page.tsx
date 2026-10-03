import Link from "next/link";
import { ClipboardList, Link2, Plug } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { STAFF, pageUser } from "@/lib/session";
import { appUrl } from "@/lib/mailer";
import { Onboarding } from "@/models/Onboarding";
import { Client } from "@/models/Client";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { OnboardingActions } from "@/components/OnboardingRow";
import { OnboardingDetails } from "@/components/OnboardingDetails";
import { StatusTabs } from "@/components/Filters";
import { CopyButton } from "@/components/actions";
import { ONBOARDING_STATUSES } from "@/lib/constants";
import { formatDate, serialize } from "@/lib/utils";
import type { ClientT, OnboardingT } from "@/lib/types";

export const metadata = { title: "Onboarding Submissions" };

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ status?: string; open?: string }> }) {
  const user = await pageUser(STAFF);
  const isOwner = user.role === "super_admin";
  const sp = await searchParams;
  await dbConnect();
  // "Converted" is the old name of Approved.
  const filter = sp.status === "Approved" ? { status: { $in: ["Approved", "Converted"] } } : sp.status ? { status: sp.status } : {};
  const [docs, statusAgg, clientDocs] = await Promise.all([
    Onboarding.find(filter).sort({ createdAt: -1 }).limit(500).populate("client", "name company").lean(),
    Onboarding.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Client.find().sort({ name: 1 }).select("name company email").lean(),
  ]);
  const items = serialize<OnboardingT[]>(docs);
  const clients = serialize<{ _id: string; name: string; company?: string; email?: string }[]>(clientDocs);
  const counts: Record<string, number> = { All: 0 };
  for (const s of statusAgg as { _id: string; n: number }[]) {
    const key = s._id === "Converted" || s._id === "Approving" ? (s._id === "Converted" ? "Approved" : "Reviewed") : s._id;
    counts[key] = (counts[key] || 0) + s.n;
    counts.All! += s.n;
  }
  const formLink = appUrl("/onboarding");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding Submissions"
        subtitle="Forms from clients. Nothing becomes a project until you approve it and tag it to a client."
      />

      <div className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand dark:text-[#8f9bff]">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <div className="font-bold text-heading">Onboarding form link</div>
            <p className="text-xs text-muted">
              Best: open the client&apos;s page and use <b>Send onboarding form</b>. Their link is personal, so the form arrives already tagged to them. This general link works for new leads.
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
          <input className="input font-mono text-xs sm:max-w-sm" readOnly value={formLink} />
          <CopyButton text={formLink} />
          <Link href="/onboarding" target="_blank" className="btn btn-outline">Preview</Link>
        </div>
      </div>

      <StatusTabs basePath="/submissions" current={sp.status} options={[...ONBOARDING_STATUSES]} params={{ status: sp.status }} counts={counts} />

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No submissions here" text="Send the onboarding form to a client; their answers will appear here for approval." />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Contact</th>
                  <th>Package</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const c = s.client as ClientT | null;
                  const status = s.status === "Converted" ? "Approved" : s.status === "Approving" ? "Reviewed" : s.status;
                  return (
                    <tr key={s._id}>
                      <td>
                        <div className="font-semibold text-heading">{s.company || s.name}</div>
                        <div className="text-xs text-muted">{s.source === "portal" ? "Onboarding form" : "External website"}</div>
                      </td>
                      <td>
                        <div>{s.name}</div>
                        <div className="text-xs text-muted">{s.email || s.phone || "—"}</div>
                      </td>
                      <td className="whitespace-nowrap">{s.budget || "—"}</td>
                      <td className="whitespace-nowrap">
                        {c ? (
                          isOwner ? (
                            <Link href={`/clients/${c._id}`} className="font-medium hover:text-brand">{c.company || c.name}</Link>
                          ) : (
                            <span className="font-medium">{c.company || c.name}</span>
                          )
                        ) : (
                          <span className="text-muted">Not tagged</span>
                        )}
                      </td>
                      <td><Badge status={status} /></td>
                      <td className="whitespace-nowrap text-muted">{formatDate(s.createdAt)}</td>
                      <td>
                        <OnboardingActions
                          item={s}
                          clients={clients}
                          canDelete={isOwner}
                          autoOpen={sp.open === s._id}
                          details={<OnboardingDetails item={s} />}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isOwner && (
        <details className="card p-5">
          <summary className="flex cursor-pointer items-center gap-2 font-bold text-heading">
            <Plug className="h-5 w-5 text-brand" /> Receive forms from another website (API)
          </summary>
          <p className="mt-3 text-sm text-muted">
            Another website can send leads with a <b>POST</b> to <code>{appUrl("/api/onboarding/submit")}</code> and header <code>x-api-key</code> (ONBOARDING_API_KEY).
            Fields: <code>name</code> (required), <code>email</code>, <code>phone</code>, <code>company</code>, <code>website</code>, <code>services</code>, <code>budget</code>,{" "}
            <code>message</code>. They appear here for approval too.
          </p>
        </details>
      )}
    </div>
  );
}
