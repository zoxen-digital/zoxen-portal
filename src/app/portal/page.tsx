import Link from "next/link";
import { AlertCircle, ArrowRight, BellRing, CalendarDays, Eye, FileSignature, FileText, Rocket, Video } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { projectScope, toPortal } from "@/lib/projects";
import { Project } from "@/models/Project";
import { Invoice } from "@/models/Invoice";
import { Meeting } from "@/models/Meeting";
import { Activity } from "@/models/Activity";
import { Quote } from "@/models/Quote";
import { Contract } from "@/models/Contract";
import { Badge, EmptyState } from "@/components/ui";
import { ProgressBar } from "@/components/ProjectForm";
import { ActivityFeed } from "@/components/ProjectBits";
import { LocalTime } from "@/components/LocalTime";
import { PushToggle } from "@/components/NotificationBell";
import { RequestMeetingButton } from "@/components/PortalActions";
import { formatDate, formatMoney, serialize } from "@/lib/utils";
import type { ActivityT, InvoiceT, MeetingT, ProjectT } from "@/lib/types";

export const metadata = { title: "Overview" };

export default async function PortalHome() {
  const user = await pageUser(["client"]);
  await dbConnect();
  const scope = projectScope(user);
  const [projectDocs, invoiceDocs, meetingDocs, activityDocs, openQuotes, openContracts] = await Promise.all([
    Project.find(scope).sort({ updatedAt: -1 }).populate("team", "name").lean(),
    Invoice.find({ client: scope.client, status: { $nin: ["Draft", "Cancelled"] } }).sort({ issueDate: -1 }).lean(),
    Meeting.find({ client: scope.client, status: { $ne: "Declined" }, date: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } }).sort({ date: 1 }).limit(5).lean(),
    Activity.find({ client: scope.client, visibleToClient: true }).sort({ createdAt: -1 }).limit(12).lean(),
    Quote.find({ client: scope.client, status: "Sent" }).select("number title publicId validUntil").lean<{ _id: unknown; number: string; title: string; publicId: string; validUntil?: Date }[]>(),
    Contract.find({ client: scope.client, status: "Sent" }).select("number title publicId").lean<{ _id: unknown; number: string; title: string; publicId: string }[]>(),
  ]);
  const now = Date.now();
  const quotesToAccept = openQuotes.filter((q) => !q.validUntil || new Date(q.validUntil).getTime() + 86_400_000 > now);

  const projects = serialize<ProjectT[]>(projectDocs).map(toPortal);
  const invoices = serialize<InvoiceT[]>(invoiceDocs);
  const meetings = serialize<MeetingT[]>(meetingDocs);
  const activity = serialize<ActivityT[]>(activityDocs);

  const toReview = projects.filter((p) => p.inReview);
  const actions = projects.flatMap((p) => p.actionsNeeded.map((a) => ({ ...a, project: p })));
  const unpaid = invoices.filter((i) => (i.totals?.balance || 0) > 0);
  const byCurrency = new Map<string, number>();
  for (const i of unpaid) byCurrency.set(i.currency, (byCurrency.get(i.currency) || 0) + (i.totals?.balance || 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[28px]">Hi {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted">Here is where everything stands with your projects.</p>
      </div>

      {(toReview.length > 0 || actions.length > 0 || quotesToAccept.length > 0 || openContracts.length > 0) && (
        <div className="space-y-3">
          {quotesToAccept.map((q) => (
            <Link key={String(q._id)} href={`/quote/${q.publicId}`} className="flex items-center gap-4 rounded-2xl border border-brand/30 bg-brand/5 p-4 transition hover:bg-brand/10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand dark:text-[#8f9bff]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-heading">New proposal: {q.title}</div>
                <div className="text-sm text-muted">{q.number}{q.validUntil ? ` · valid until ${formatDate(q.validUntil)}` : ""}. Review and accept online.</div>
              </div>
              <span className="btn btn-primary hidden sm:inline-flex">
                View <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
          {openContracts.map((c) => (
            <Link key={String(c._id)} href={`/contract/${c.publicId}`} className="flex items-center gap-4 rounded-2xl border border-brand/30 bg-brand/5 p-4 transition hover:bg-brand/10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand dark:text-[#8f9bff]">
                <FileSignature className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-heading">Please sign: {c.title}</div>
                <div className="text-sm text-muted">{c.number}. Takes less than a minute.</div>
              </div>
              <span className="btn btn-primary hidden sm:inline-flex">
                Sign <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
          {toReview.map((p) => (
            <Link
              key={p._id}
              href={`/portal/projects/${p._id}`}
              className="flex items-center gap-4 rounded-2xl border border-violet/30 bg-violet/5 p-4 transition hover:bg-violet/10"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet">
                <Eye className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-heading">{p.title} is ready for your review</div>
                <div className="text-sm text-muted">Take a look, then approve it or request changes.</div>
              </div>
              <span className="btn btn-primary hidden sm:inline-flex">
                Review now <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
          {actions.map((a) => (
            <Link
              key={a._id}
              href={`/portal/projects/${a.project._id}`}
              className="flex items-center gap-4 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 transition hover:bg-amber-100/60 dark:border-amber-500/30 dark:bg-amber-500/10"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-heading">Action needed: {a.title}</div>
                <div className="truncate text-sm text-muted">
                  {a.project.title}
                  {a.dueDate ? ` · by ${formatDate(a.dueDate)}` : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-bold text-heading">
            <Rocket className="h-4 w-4 text-brand dark:text-[#8f9bff]" /> Your projects
          </h2>
          {projects.length === 0 ? (
            <div className="card">
              <EmptyState icon={Rocket} title="No projects yet" text="Once your project starts, you will follow every step here." />
            </div>
          ) : (
            projects.map((p) => (
              <Link key={p._id} href={`/portal/projects/${p._id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-heading">{p.title}</div>
                    <div className="text-xs text-muted">
                      {p.service}
                      {p.dueDate ? ` · Target ${formatDate(p.dueDate)}` : ""}
                    </div>
                  </div>
                  <Badge status={p.stage} dot />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar value={p.progress} />
                  <span className="w-10 text-right text-sm font-bold text-heading">{p.progress}%</span>
                </div>
                {p.clientUpdate && <p className="mt-3 line-clamp-2 text-sm text-muted">Latest: {p.clientUpdate}</p>}
              </Link>
            ))
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-heading">
              <FileText className="h-4 w-4 text-brand dark:text-[#8f9bff]" /> Invoices
            </h2>
            {unpaid.length === 0 ? (
              <p className="text-sm text-muted">{invoices.length ? "All invoices are paid. Thank you!" : "No invoices yet."}</p>
            ) : (
              <>
                <div className="text-sm text-muted">Balance due</div>
                {[...byCurrency].map(([cur, amt]) => (
                  <div key={cur} className="text-2xl font-bold text-red-500">{formatMoney(amt, cur)}</div>
                ))}
                <p className="mt-1 text-xs text-muted">{unpaid.length} open invoice{unpaid.length > 1 ? "s" : ""}</p>
              </>
            )}
            <Link href="/portal/invoices" className="btn btn-outline mt-4 w-full">View invoices</Link>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-heading">
              <CalendarDays className="h-4 w-4 text-brand dark:text-[#8f9bff]" /> Upcoming meetings
            </h2>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted">No meetings scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {meetings.map((m) => (
                  <li key={m._id} className="rounded-xl border border-line p-3">
                    {m.status === "Requested" && (
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-violet">Requested · waiting for confirmation</div>
                    )}
                    <div className="text-sm font-semibold text-heading">{m.title}</div>
                    <div className="text-xs text-muted"><LocalTime iso={m.date} /></div>
                    {m.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{m.notes}</p>}
                    {m.link && (
                      <a href={m.link} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm mt-2">
                        <Video className="h-4 w-4" /> Join
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <RequestMeetingButton projects={projects.map((p) => ({ _id: p._id, title: p.title }))} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 font-bold text-heading">
              <BellRing className="h-4 w-4 text-brand dark:text-[#8f9bff]" /> Get instant updates
            </h2>
            <p className="mb-3 text-xs text-muted">Get a phone or desktop alert when your project moves forward or needs your review.</p>
            <PushToggle />
          </div>

          <ActivityFeed items={activity} title="Recent updates" />
        </div>
      </div>
    </div>
  );
}
