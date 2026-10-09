import { Trash2 } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { AGENT, pageUser } from "@/lib/session";
import { TrashItem } from "@/models/TrashItem";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { StatusTabs } from "@/components/Filters";
import { RestoreButton } from "@/components/RestoreButton";
import { LocalTime } from "@/components/LocalTime";

export const metadata = { title: "Owner · Recycle Bin" };

// The main thing in a group (a client deleted with its projects shows as the client).
const PRIORITY = ["Client", "User", "Project", "Invoice", "Quote", "Contract", "RecurringPlan", "Ticket", "Meeting", "Query", "Package", "Onboarding", "Review", "Referral"];
const rank = (m: string) => (PRIORITY.indexOf(m) + 1 || 99);

const ROLE: Record<string, string> = { agent: "Owner", super_admin: "Super Admin", team_admin: "Team", client: "Client", system: "System" };

/** Everything deleted in the last 30 days, grouped by the action that deleted it. Only the owner can restore. */
export default async function TrashPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageUser(AGENT);
  const sp = await searchParams;
  await dbConnect();
  const restored = sp.status === "Restored";
  const groups = await TrashItem.aggregate([
    { $match: { restoredAt: restored ? { $ne: null } : null } },
    { $sort: { deletedAt: 1 } },
    {
      $group: {
        // Items deleted without a request batch are their own group.
        _id: { $ifNull: ["$batch", { $toString: "$_id" }] },
        items: { $push: { model: "$model", label: "$label", deletedAt: "$deletedAt", deletedBy: "$deletedBy", deletedByRole: "$deletedByRole", restoredAt: "$restoredAt", restoredBy: "$restoredBy" } },
        firstAt: { $first: "$deletedAt" },
        models: { $addToSet: "$model" },
        count: { $sum: 1 },
      },
    },
    { $sort: { firstAt: -1 } },
    { $limit: 300 },
  ]);
  const active = await TrashItem.countDocuments({ restoredAt: null });
  const back = await TrashItem.countDocuments({ restoredAt: { $ne: null } });

  return (
    <div>
      <PageHeader title="Recycle Bin" subtitle="Anything deleted by anyone stays here for 30 days. Restore brings it back exactly as it was." />
      <div className="mb-4">
        <StatusTabs basePath="/agent/trash" allLabel="Deleted" current={sp.status} options={["Restored"]} params={sp} counts={{ Deleted: active, Restored: back }} />
      </div>
      <div className="card overflow-hidden">
        {groups.length === 0 ? (
          <EmptyState icon={Trash2} title={restored ? "Nothing restored yet" : "The recycle bin is empty"} />
        ) : (
          <ul className="divide-y divide-line">
            {groups.map((g) => {
              type It = { model: string; label: string; deletedAt: Date; deletedBy: string; deletedByRole: string; restoredAt?: Date; restoredBy?: string };
              const f = [...(g.items as It[])].sort((a, b) => rank(a.model) - rank(b.model))[0]!;
              const days = Math.max(0, 30 - Math.floor((Date.now() - new Date(f.deletedAt).getTime()) / 86_400_000));
              return (
                <li key={String(g._id)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge status={f.model} />
                      <span className="truncate font-semibold text-heading">{f.label}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Deleted by <b className="text-fg">{f.deletedBy}</b> ({ROLE[f.deletedByRole] || f.deletedByRole}) · <LocalTime iso={new Date(f.deletedAt).toISOString()} />
                      {g.count > 1 && ` · with ${g.count - 1} related item${g.count > 2 ? "s" : ""} (${(g.models as string[]).filter((m) => m !== f.model).join(", ")})`}
                    </div>
                    {restored && f.restoredAt && (
                      <div className="text-xs text-emerald-600">
                        Restored by {f.restoredBy} · <LocalTime iso={new Date(f.restoredAt).toISOString()} />
                      </div>
                    )}
                  </div>
                  {!restored && (
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted">{days} day{days === 1 ? "" : "s"} left</span>
                      <RestoreButton batch={String(g._id)} label={f.label} count={g.count} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
