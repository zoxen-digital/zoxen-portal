import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Circle, ExternalLink, FileText, Globe, MessageSquareText, RefreshCcw, Star } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { projectScope, toPortal } from "@/lib/projects";
import { validId } from "@/lib/api";
import { Project } from "@/models/Project";
import { Activity } from "@/models/Activity";
import { Badge, CardHeader } from "@/components/ui";
import { ProgressBar } from "@/components/ProjectForm";
import { ActivityFeed, StageTimeline } from "@/components/ProjectBits";
import { FeedbackForm, ReviewActions } from "@/components/PortalActions";
import { LocalTime } from "@/components/LocalTime";
import { ChatThread } from "@/components/ChatThread";
import { formatDate, serialize } from "@/lib/utils";
import type { ActivityT, ProjectT } from "@/lib/types";

export default async function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser(["client"]);
  const { id } = await params;
  if (!validId(id)) notFound();
  await dbConnect();
  const doc = await Project.findOne({ _id: id, ...projectScope(user) }).populate("team", "name").lean();
  if (!doc) notFound();
  const raw = serialize<ProjectT>(doc);
  const p = toPortal(raw);
  const activity = serialize<ActivityT[]>(await Activity.find({ project: id, visibleToClient: true }).sort({ createdAt: -1 }).limit(30).lean());

  const canRequest = ["Client Review", "Launch", "Live"].includes(raw.stage);
  const finished = ["Live", "Completed"].includes(raw.stage);
  const checklistDone = p.checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All projects
      </Link>

      <div className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-heading">{p.title}</h1>
              <Badge status={p.stage} dot />
            </div>
            <p className="mt-1 text-sm text-muted">
              {p.service}
              {p.team.length ? ` · Your team: ${p.team.join(", ")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.previewUrl && !finished && (
              <a href={p.previewUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                <ExternalLink className="h-4 w-4" /> Open preview
              </a>
            )}
            {p.liveUrl && (
              <a href={p.liveUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                <Globe className="h-4 w-4" /> Visit live site
              </a>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium text-muted">Progress</span>
              <span className="font-bold text-heading">{p.progress}%</span>
            </div>
            <ProgressBar value={p.progress} className="h-2.5" />
          </div>
          <div className="text-sm">
            <div className="text-muted">Started</div>
            <div className="font-semibold text-heading">{formatDate(p.startDate)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted">Target date</div>
            <div className="font-semibold text-heading">{formatDate(p.dueDate)}</div>
          </div>
        </div>
      </div>

      <StageTimeline stage={raw.stage} forClient />

      {p.inReview && (
        <div className="card border-violet/40 bg-violet/5 p-6">
          <h2 className="text-lg font-bold text-heading">Your review is needed</h2>
          <p className="mt-1 text-sm text-muted">
            {p.previewUrl ? "Open the preview, check everything, then approve it or tell us what to change." : "Check the latest work, then approve it or tell us what to change."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            {p.previewUrl && (
              <a href={p.previewUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                <ExternalLink className="h-4 w-4" /> Open preview
              </a>
            )}
            <ReviewActions projectId={p._id} canApprove canRequest roundsUsed={p.revisions.length} limit={p.revisionLimit} />
          </div>
        </div>
      )}

      {p.actionsNeeded.length > 0 && (
        <div className="card border-amber-300/60 p-5 dark:border-amber-500/30">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-heading">
            <AlertCircle className="h-5 w-5 text-amber-500" /> We need something from you
          </h2>
          <ul className="space-y-2">
            {p.actionsNeeded.map((a) => (
              <li key={a._id} className="rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10">
                <div className="text-sm font-semibold text-heading">{a.title}</div>
                {a.details && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{a.details}</p>}
                {a.dueDate && <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Needed by {formatDate(a.dueDate)}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Send what is needed in the <a href="#chat" className="font-semibold text-brand hover:underline dark:text-[#8f9bff]">project chat</a> below (you can attach files). This disappears once we receive it.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ChatThread
            endpoint={`/api/portal/projects/${p._id}/messages`}
            side="client"
            title="Message the team"
            subtitle="Questions, feedback and files: everything about this project in one place."
            uploads={!!process.env.BLOB_READ_WRITE_TOKEN}
          />
          {p.clientUpdate && (
            <div className="card p-5">
              <h2 className="mb-2 flex items-center gap-2 font-bold text-heading">
                <MessageSquareText className="h-4 w-4 text-brand dark:text-[#8f9bff]" /> Latest update from the team
              </h2>
              <p className="whitespace-pre-wrap text-sm text-fg">{p.clientUpdate}</p>
            </div>
          )}

          {p.checklist.length > 0 && (
            <div className="card">
              <CardHeader icon={CheckCircle2} title="Progress checklist" subtitle={`${checklistDone} of ${p.checklist.length} done`} />
              <ul className="grid gap-x-6 px-5 pb-5 sm:grid-cols-2">
                {p.checklist.map((c, i) => (
                  <li key={i} className="flex items-center gap-2.5 py-1.5 text-sm">
                    {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-line" />}
                    <span className={c.done ? "text-fg" : "text-muted"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <CardHeader
              icon={RefreshCcw}
              title="Revisions"
              subtitle={p.revisionLimit ? `${p.revisions.length} of ${p.revisionLimit} included rounds used` : `${p.revisions.length} rounds`}
              action={
                !p.inReview && canRequest ? (
                  <ReviewActions projectId={p._id} canApprove={false} canRequest roundsUsed={p.revisions.length} limit={p.revisionLimit} />
                ) : undefined
              }
            />
            <div className="px-5 pb-5">
              {p.revisions.length === 0 ? (
                <p className="text-sm text-muted">No changes requested yet. When the project is ready for review you can request changes here.</p>
              ) : (
                <ul className="space-y-2">
                  {[...p.revisions].reverse().map((r) => (
                    <li key={r._id} className="rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-heading">
                          Round {r.round}
                          {r.extra && <span className="ml-2 text-xs font-medium text-amber-600">extra round</span>}
                        </span>
                        <Badge status={r.status} />
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-fg">{r.request}</p>
                      <p className="mt-1 text-xs text-muted">
                        <LocalTime iso={r.createdAt} dateOnly />
                        {r.completedAt && <> · done <LocalTime iso={r.completedAt} dateOnly /></>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {p.description && (
            <div className="card p-5">
              <h2 className="mb-2 font-bold text-heading">Project scope</h2>
              <p className="whitespace-pre-wrap text-sm text-fg">{p.description}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {p.approvedAt && (
            <div className="card flex items-start gap-3 p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
              <div className="text-sm">
                <div className="font-semibold text-heading">You approved this work</div>
                <div className="text-muted"><LocalTime iso={p.approvedAt} /></div>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-heading">
              <FileText className="h-4 w-4 text-brand dark:text-[#8f9bff]" /> Documents
            </h2>
            {p.documents.length === 0 ? (
              <p className="text-sm text-muted">No documents shared yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {p.documents.map((d) => (
                  <li key={d._id} className="py-2">
                    <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-heading hover:text-brand">
                      <FileText className="h-4 w-4 shrink-0 text-muted" />
                      <span className="truncate">{d.name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {p.domain && <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Domain: <b className="text-fg">{p.domain}</b></p>}
          </div>

          {finished && (
            <div className="card p-5">
              <h2 className="mb-1 flex items-center gap-2 font-bold text-heading">
                <Star className="h-4 w-4 text-amber-400" /> Rate your experience
              </h2>
              <p className="mb-3 text-xs text-muted">Your feedback helps us serve you better.</p>
              <FeedbackForm projectId={p._id} initial={p.feedback} />
            </div>
          )}

          <ActivityFeed items={activity} title="Project timeline" />
        </div>
      </div>
    </div>
  );
}
