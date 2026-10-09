import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { AGENT, pageUser } from "@/lib/session";
import { LoginEvent } from "@/models/LoginEvent";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { StatusTabs } from "@/components/Filters";
import { LocalTime } from "@/components/LocalTime";
import { serialize } from "@/lib/utils";

export const metadata = { title: "Owner · Login History" };

const ROLE: Record<string, string> = { agent: "Owner", super_admin: "Super Admin", team_admin: "Team", client: "Client" };
type Row = { _id: string; at: string; name?: string; email: string; role?: string; success: boolean; ip?: string; country?: string; city?: string; device?: string; newDevice?: boolean };

export default async function LoginsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageUser(AGENT);
  const sp = await searchParams;
  await dbConnect();
  const filter =
    sp.status === "Failed" ? { success: false } : sp.status === "New device" ? { newDevice: true } : sp.status === "Staff" ? { role: { $in: ["super_admin", "team_admin"] } } : {};
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [rows, failed24, newDevices, all, failedAll, staffAll, newAll] = await Promise.all([
    LoginEvent.find(filter).sort({ at: -1 }).limit(300).lean(),
    LoginEvent.countDocuments({ success: false, at: { $gte: dayAgo } }),
    LoginEvent.countDocuments({ newDevice: true, at: { $gte: new Date(Date.now() - 7 * 86_400_000) } }),
    LoginEvent.estimatedDocumentCount(),
    LoginEvent.countDocuments({ success: false }),
    LoginEvent.countDocuments({ role: { $in: ["super_admin", "team_admin"] } }),
    LoginEvent.countDocuments({ newDevice: true }),
  ]);
  const items = serialize<Row[]>(rows);

  return (
    <div>
      <PageHeader title="Login History" subtitle="Every sign-in attempt. New devices of admins and team members are alerted to you." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={ShieldAlert} label="Failed sign-ins (24h)" value={failed24} tone={failed24 > 5 ? "red" : "slate"} href="/agent/logins?status=Failed" />
        <StatCard icon={ShieldCheck} label="New devices (7 days)" value={newDevices} tone={newDevices ? "amber" : "slate"} href="/agent/logins?status=New+device" />
        <StatCard icon={ShieldCheck} label="Force logout or ban" value="Admins & Team" tone="blue" href="/agent/users" />
      </div>
      <div className="mb-4">
        <StatusTabs basePath="/agent/logins" current={sp.status} options={["Staff", "New device", "Failed"]} params={sp} counts={{ All: all, Failed: failedAll, Staff: staffAll, "New device": newAll }} />
      </div>
      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No sign-ins here" />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Account</th>
                  <th>Result</th>
                  <th>Device</th>
                  <th>Location</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r._id}>
                    <td className="whitespace-nowrap text-xs text-muted">
                      <LocalTime iso={r.at} />
                    </td>
                    <td>
                      <div className="font-semibold text-heading">{r.name || r.email}</div>
                      <div className="text-xs text-muted">
                        {r.name ? r.email : "Unknown account"}
                        {r.role ? ` · ${ROLE[r.role] || r.role}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge status={r.success ? (r.newDevice ? "New device" : "Signed in") : "Failed"} />
                    </td>
                    <td className="whitespace-nowrap text-sm">{r.device || "—"}</td>
                    <td className="whitespace-nowrap text-sm text-muted">{[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{r.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Showing the latest 300. Something looks wrong? Ban the account or force a logout on <Link href="/agent/users" className="font-semibold text-brand hover:underline">Admins &amp; Team</Link>.
      </p>
    </div>
  );
}
