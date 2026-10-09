import { AlertTriangle, CalendarClock, CalendarDays, Hourglass, Inbox, OctagonX, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AGENT, pageUser } from "@/lib/session";
import { today, type TodayItem } from "@/lib/today";
import { dbConnect } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { PageHeader, StatCard } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { cn } from "@/lib/utils";

export const metadata = { title: "Owner · My Day" };

/** Agency-wide day view for the owner. Read only: no links into clients or projects. */
function Section({ icon: Icon, title, items, tone, showTime }: { icon: LucideIcon; title: string; items: TodayItem[]; tone: string; showTime?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <Icon className={cn("h-5 w-5", tone)} />
        <h2 className="font-bold text-heading">
          {title} <span className="text-muted">({items.length})</span>
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.key} className="flex items-start gap-3 p-4">
              <span className="mt-0.5 shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted">{i.kind}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-heading">{i.title}</span>
                <span className="block truncate text-xs text-muted">{i.sub}</span>
              </span>
              {i.due && (
                <span className="shrink-0 text-xs text-muted">
                  <LocalTime iso={i.due} dateOnly={!showTime} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AgentDay() {
  const user = await pageUser(AGENT);
  const [d, actionsToday] = await Promise.all([
    today(user),
    (async () => {
      await dbConnect();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return AuditLog.countDocuments({ at: { $gte: start } });
    })(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Day" subtitle="Everything across the agency that needs attention today (view only)." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={AlertTriangle} label="Overdue" value={d.overdue.length} tone={d.overdue.length ? "red" : "slate"} />
        <StatCard icon={CalendarClock} label="Due today" value={d.dueToday.length} tone={d.dueToday.length ? "amber" : "slate"} />
        <StatCard icon={Inbox} label="Waiting on team" value={d.waitingOnTeam.length} tone={d.waitingOnTeam.length ? "violet" : "slate"} />
        <StatCard icon={Hourglass} label="Waiting on client" value={d.waitingOnClient.length} tone="blue" />
        <StatCard icon={ScrollText} label="Team actions today" value={actionsToday} tone="green" href="/agent/audit" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section icon={AlertTriangle} tone="text-red-500" title="Overdue" items={d.overdue} />
        <Section icon={CalendarClock} tone="text-amber-500" title="Due today" items={d.dueToday} />
        <Section icon={Inbox} tone="text-violet" title="Waiting on the team" items={d.waitingOnTeam} showTime />
        <Section icon={CalendarDays} tone="text-emerald-500" title="Meetings today" items={d.meetings} showTime />
        {d.blocked.length > 0 && <Section icon={OctagonX} tone="text-red-500" title="Blocked projects" items={d.blocked} />}
        <Section icon={Hourglass} tone="text-brand" title="Waiting on clients" items={d.waitingOnClient} />
      </div>
    </div>
  );
}
