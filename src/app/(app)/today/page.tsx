import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarDays, Hourglass, Inbox, OctagonX, PartyPopper } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STAFF, pageUser } from "@/lib/session";
import { today, type TodayItem } from "@/lib/today";
import { PageHeader, StatCard } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { cn } from "@/lib/utils";

export const metadata = { title: "My Day" };

const KIND_STYLE: Record<TodayItem["kind"], string> = {
  Project: "bg-blue-50 text-brand dark:bg-blue-500/10 dark:text-blue-300",
  Issue: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Revision: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  Ticket: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  Query: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  Meeting: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Message: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
};

function Section({ icon: Icon, title, hint, items, tone, empty, showTime }: { icon: LucideIcon; title: string; hint: string; items: TodayItem[]; tone: string; empty: string; showTime?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <Icon className={cn("h-5 w-5", tone)} />
        <div className="flex-1">
          <h2 className="font-bold text-heading">
            {title} <span className="text-muted">({items.length})</span>
          </h2>
          <p className="text-xs text-muted">{hint}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-start gap-3 p-4 hover:bg-surface-2">
                <span className={cn("mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold", KIND_STYLE[i.kind])}>{i.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-heading">{i.title}</span>
                  <span className="block truncate text-xs text-muted">{i.sub}</span>
                </span>
                {i.due && (
                  <span className="shrink-0 text-xs text-muted">
                    <LocalTime iso={i.due} dateOnly={!showTime} />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function TodayPage() {
  const user = await pageUser(STAFF);
  const d = await today(user);
  const clear = !d.overdue.length && !d.dueToday.length && !d.waitingOnTeam.length && !d.blocked.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`My Day · ${user.name.split(" ")[0]}`}
        subtitle={user.role === "super_admin" ? "Everything across the agency that needs attention today." : "Your work for today: what is late, what is due, and who is waiting on you."}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={AlertTriangle} label="Overdue" value={d.overdue.length} tone={d.overdue.length ? "red" : "slate"} />
        <StatCard icon={CalendarClock} label="Due today" value={d.dueToday.length} tone={d.dueToday.length ? "amber" : "slate"} />
        <StatCard icon={Inbox} label="Waiting on you" value={d.waitingOnTeam.length} tone={d.waitingOnTeam.length ? "violet" : "slate"} />
        <StatCard icon={Hourglass} label="Waiting on client" value={d.waitingOnClient.length} tone="blue" />
      </div>

      {clear && (
        <div className="card flex items-center gap-3 p-5 text-sm">
          <PartyPopper className="h-6 w-6 text-emerald-500" />
          <span>
            <b className="text-heading">All clear.</b> Nothing is late or waiting on you. Good time to push projects forward.
          </span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Section icon={AlertTriangle} tone="text-red-500" title="Overdue" hint="Past the due date. Finish or update the date today." items={d.overdue} empty="Nothing overdue." />
        <Section icon={CalendarClock} tone="text-amber-500" title="Due today" hint="Deliver before the end of the day." items={d.dueToday} empty="Nothing due today." />
        <Section icon={Inbox} tone="text-violet" title="Waiting on you" hint="Client messages, change requests and new tickets with no reply yet." items={d.waitingOnTeam} empty="No one is waiting on you." showTime />
        <Section icon={CalendarDays} tone="text-emerald-500" title="Meetings today" hint="Join links are on the client page." items={d.meetings} empty="No meetings today." showTime />
        {d.blocked.length > 0 && <Section icon={OctagonX} tone="text-red-500" title="Blocked projects" hint="Clear the blocker or escalate." items={d.blocked} empty="" />}
        <Section icon={Hourglass} tone="text-brand" title="Waiting on client" hint="Follow up if it has been more than 2 days." items={d.waitingOnClient} empty="Nothing waiting on clients." />
      </div>
    </div>
  );
}
