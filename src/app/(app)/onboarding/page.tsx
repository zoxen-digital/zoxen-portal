import { ClipboardList, Plug } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { OnboardingActions } from "@/components/OnboardingRow";
import { StatusTabs } from "@/components/Filters";
import { ONBOARDING_STATUSES } from "@/lib/constants";
import { formatDate, serialize } from "@/lib/utils";
import type { OnboardingT } from "@/lib/types";

export const metadata = { title: "Onboarding Submissions" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  await dbConnect();
  const filter = sp.status ? { status: sp.status } : {};
  const [docs, statusAgg] = await Promise.all([
    Onboarding.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
    Onboarding.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const items = serialize<OnboardingT[]>(docs);
  const counts: Record<string, number> = { All: 0 };
  for (const s of statusAgg as { _id: string; n: number }[]) {
    counts[s._id] = s.n;
    counts.All! += s.n;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-app-domain.com";
  const keySet = !!process.env.ONBOARDING_API_KEY;

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding Submissions" subtitle="Leads from your onboarding form. Review them, then convert to a client in one click." />

      <StatusTabs basePath="/onboarding" current={sp.status} options={[...ONBOARDING_STATUSES]} params={sp} counts={counts} />

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No submissions yet"
            text="Once your onboarding website is connected, every form submission will appear here automatically."
          />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Services</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className="font-semibold text-heading">{s.name}</div>
                      <div className="text-xs text-muted">{s.company}</div>
                    </td>
                    <td>
                      <div>{s.email || "—"}</div>
                      <div className="text-xs text-muted">{s.phone}</div>
                    </td>
                    <td className="max-w-[220px] truncate">{s.services?.join(", ") || "—"}</td>
                    <td className="whitespace-nowrap">{s.budget || "—"}</td>
                    <td>
                      <Badge status={s.status} />
                    </td>
                    <td className="whitespace-nowrap text-muted">{formatDate(s.createdAt)}</td>
                    <td>
                      <OnboardingActions item={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Plug className="h-5 w-5 text-brand" />
          <h2 className="font-bold text-heading">Connect your onboarding website</h2>
          <Badge status={keySet ? "Active" : "Pending"} className="ml-auto" />
        </div>
        <p className="text-sm text-muted">
          Send a <b>POST</b> request from your onboarding form to the endpoint below. Supported fields: <code>name</code> (required), <code>email</code>,{" "}
          <code>phone</code>, <code>company</code>, <code>website</code>, <code>services</code>, <code>budget</code>, <code>message</code>. Any extra fields are
          saved too. {keySet ? "" : "Set ONBOARDING_API_KEY in .env.local to protect this endpoint."}
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-navy p-4 text-xs leading-relaxed text-slate-200">{`fetch("${appUrl}/api/onboarding/submit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_ONBOARDING_API_KEY"
  },
  body: JSON.stringify({
    name: "Ahmed Khan",
    email: "ahmed@company.com",
    phone: "+92 300 1234567",
    company: "Khan Tech Solutions",
    services: ["Website Development", "SEO"],
    budget: "PKR 100k - 150k",
    message: "Need a 6 page business website"
  })
});`}</pre>
      </div>
    </div>
  );
}
