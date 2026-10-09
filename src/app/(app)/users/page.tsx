import { UserCog } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { mailEnabled } from "@/lib/mailer";
import { User } from "@/models/User";
import { Client } from "@/models/Client";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
import { StatusTabs } from "@/components/Filters";
import { NewUserButton, UserActions } from "@/components/UserForm";
import { formatDate, serialize } from "@/lib/utils";
import type { ClientT, UserT } from "@/lib/types";
import type { ClientOption } from "@/components/QueryForm";

export const metadata = { title: "Team & Portal Users" };

const TABS = ["Team", "Clients"];
const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", team_admin: "Team Admin", client: "Client" };
const STATUS_LABEL: Record<string, string> = { invited: "Invited", active: "Active", disabled: "Disabled" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const me = await pageUser(ADMIN);
  const sp = await searchParams;
  await dbConnect();

  const filter =
    sp.status === "Team" ? { role: { $in: ["super_admin", "team_admin"] } } : sp.status === "Clients" ? { role: "client" } : {};
  const [docs, clientDocs, teamCount, clientCount] = await Promise.all([
    User.find({ ...filter, role: (filter as { role?: unknown }).role ?? { $ne: "agent" } }).sort({ role: -1, name: 1 }).populate("client", "name company").lean(),
    Client.find().sort({ name: 1 }).select("name company").lean(),
    User.countDocuments({ role: { $in: ["super_admin", "team_admin"] } }),
    User.countDocuments({ role: "client" }),
  ]);
  const users = serialize<UserT[]>(docs);
  const clients = serialize<ClientOption[]>(clientDocs);

  return (
    <div>
      <PageHeader
        title="Team & Portal Users"
        subtitle="Add team members and give clients a portal login. Each person gets a secure link to set their own password."
      >
        <NewUserButton clients={clients} mailOn={mailEnabled()} />
      </PageHeader>

      {!mailEnabled() && (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Email is not set up yet, so invite links are not emailed. Copy the link shown after adding a user and send it yourself, or add
          <code className="mx-1 rounded bg-black/5 px-1">SMTP_USER</code> and <code className="mx-1 rounded bg-black/5 px-1">SMTP_PASS</code> (Gmail App Password) to your env file.
        </div>
      )}

      <div className="mb-4">
        <StatusTabs basePath="/users" current={sp.status} options={TABS} params={sp} counts={{ All: teamCount + clientCount, Team: teamCount, Clients: clientCount }} />
      </div>

      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon={UserCog} title="No users here yet" text="Add a team member or invite a client to their portal." />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Last sign in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const c = u.client as ClientT | null;
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-heading">
                              {u.name} {u._id === me.id && <span className="text-xs font-medium text-muted">(you)</span>}
                            </div>
                            <div className="truncate text-xs text-muted">
                              {u.email}
                              {u.title ? ` · ${u.title}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{ROLE_LABEL[u.role]}</td>
                      <td className="whitespace-nowrap text-muted">{c ? c.company || c.name : "—"}</td>
                      <td>
                        <Badge status={STATUS_LABEL[u.status] || u.status} />
                      </td>
                      <td className="whitespace-nowrap text-muted">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
                      <td>
                        {u.role === "super_admin" ? (
                          <span className="text-xs text-muted">Managed by owner</span>
                        ) : (
                          <UserActions user={u} clients={clients} isMe={u._id === me.id} mailOn={mailEnabled()} />
                        )}
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
