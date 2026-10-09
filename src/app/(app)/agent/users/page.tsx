import { ShieldCheck, Users } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { AGENT, pageUser } from "@/lib/session";
import { User } from "@/models/User";
import { LoginEvent } from "@/models/LoginEvent";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
import { NewStaffButton, StaffActions } from "@/components/AgentUsers";
import { LocalTime } from "@/components/LocalTime";
import { serialize } from "@/lib/utils";

export const metadata = { title: "Owner · Admins & Team" };

type Row = { _id: string; name: string; email: string; role: string; title?: string; status: string; lastLoginAt?: string };

export default async function AgentUsersPage() {
  await pageUser(AGENT);
  await dbConnect();
  const raw = await User.find({ role: { $in: ["super_admin", "team_admin"] } }).sort({ role: -1, name: 1 }).lean();
  const users = serialize<Row[]>(raw);
  // Last device per user, from the login history.
  const last = await LoginEvent.aggregate([
    { $match: { success: true, user: { $in: raw.map((u) => u._id) } } },
    { $sort: { at: -1 } },
    { $group: { _id: "$user", device: { $first: "$device" }, country: { $first: "$country" } } },
  ]);
  const device = new Map(last.map((l) => [String(l._id), [l.device, l.country].filter(Boolean).join(" · ")]));

  return (
    <div>
      <PageHeader title="Admins & Team" subtitle="Create, edit, ban or delete super admins and team members. Clients are managed by the admins.">
        <NewStaffButton />
      </PageHeader>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        Your owner account is not visible to anyone in this list or anywhere else in the app.
      </div>
      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon={Users} title="No admins or team members yet" />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-heading">{u.name}</div>
                          <div className="truncate text-xs text-muted">
                            {u.email}
                            {u.title ? ` · ${u.title}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{u.role === "super_admin" ? "Super Admin" : "Team Admin"}</td>
                    <td>
                      <Badge status={u.status === "disabled" ? "Banned" : u.status === "invited" ? "Invited" : "Active"} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {u.lastLoginAt ? <LocalTime iso={u.lastLoginAt} /> : "Never"}
                      {device.get(u._id) && <div>{device.get(u._id)}</div>}
                    </td>
                    <td>
                      <StaffActions user={u} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
