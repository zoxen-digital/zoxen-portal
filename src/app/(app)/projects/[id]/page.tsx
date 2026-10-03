import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, Globe, Mail, Phone, Star, Users } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { STAFF, pageUser } from "@/lib/session";
import { projectScope } from "@/lib/projects";
import { validId } from "@/lib/api";
import { Project } from "@/models/Project";
import { Activity } from "@/models/Activity";
import { Client } from "@/models/Client";
import { User } from "@/models/User";
import { Avatar, Badge, InfoRow } from "@/components/ui";
import { DeleteButton, StatusSelect } from "@/components/actions";
import { EditProjectButton, ProgressBar, type TeamOption } from "@/components/ProjectForm";
import { ChecklistPanel, ClientUpdatePanel, DocumentsPanel, IssuesPanel, NotesPanel, RevisionsPanel } from "@/components/ProjectPanels";
import { ActivityFeed, StageTimeline } from "@/components/ProjectBits";
import { LocalTime } from "@/components/LocalTime";
import { FollowUpButton } from "@/components/FollowUpButton";
import { ChatThread } from "@/components/ChatThread";
import { PROJECT_STAGES, STAGE_INFO, type ProjectStage } from "@/lib/constants";
import { formatDate, isOverdue, serialize } from "@/lib/utils";
import type { ActivityT, ClientT, ProjectT } from "@/lib/types";
import type { ClientOption } from "@/components/QueryForm";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser(STAFF);
  const isOwner = user.role === "super_admin";
  const { id } = await params;
  if (!validId(id)) notFound();
  await dbConnect();

  const doc = await Project.findOne({ _id: id, ...projectScope(user) })
    .populate("client", "name company email phone website")
    .populate("team", "name email title")
    .lean();
  if (!doc) notFound();

  const [activityDocs, clientDocs, teamDocs] = await Promise.all([
    Activity.find({ project: id }).sort({ createdAt: -1 }).limit(40).lean(),
    isOwner ? Client.find().sort({ name: 1 }).select("name company").lean() : [],
    isOwner ? User.find({ role: { $in: ["team_admin", "super_admin"] }, status: { $ne: "disabled" } }).sort({ name: 1 }).select("name title").lean() : [],
  ]);

  const project = serialize<ProjectT>(doc);
  const activity = serialize<ActivityT[]>(activityDocs);
  const clients = serialize<ClientOption[]>(clientDocs);
  const team = serialize<TeamOption[]>(teamDocs);
  const client = project.client as ClientT | null;
  const members = project.team.filter((t): t is { _id: string; name: string; email: string } => typeof t !== "string");
  const done = ["Live", "Completed"].includes(project.stage);
  const late = isOverdue(project.dueDate, done);
  const clientLabel = STAGE_INFO[project.stage as ProjectStage]?.client;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-heading">{project.title}</h1>
              <Badge status={project.stage} dot />
              {late && <Badge status="Overdue" />}
            </div>
            <p className="mt-1 text-sm text-muted">
              {client ? (
                isOwner ? (
                  <Link href={`/clients/${client._id}`} className="font-medium text-fg hover:text-brand">{client.company || client.name}</Link>
                ) : (
                  <span className="font-medium text-fg">{client.company || client.name}</span>
                )
              ) : (
                "Deleted client"
              )}
              {project.service ? ` · ${project.service}` : ""} · Client sees: <b className="text-fg">{clientLabel}</b>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusSelect url={`/api/projects/${project._id}`} value={project.stage} options={PROJECT_STAGES} field="stage" />
            {project.previewUrl && (
              <a href={project.previewUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                <ExternalLink className="h-4 w-4" /> Preview
              </a>
            )}
            {project.liveUrl && (
              <a href={project.liveUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                <Globe className="h-4 w-4" /> Live site
              </a>
            )}
            {client && <FollowUpButton url={`/api/projects/${project._id}/notify`} clientName={client.company || client.name} label="Follow up client" />}
            {isOwner && <EditProjectButton project={project} clients={clients} team={team} />}
            {isOwner && <DeleteButton url={`/api/projects/${project._id}`} redirectTo="/projects" confirmText={`Delete "${project.title}" and its history? This cannot be undone.`} />}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium text-muted">Progress</span>
              <span className="font-bold text-heading">{project.progress}%</span>
            </div>
            <ProgressBar value={project.progress} className="h-2.5" />
          </div>
          <div className="text-sm">
            <div className="text-muted">Start</div>
            <div className="font-semibold text-heading">{formatDate(project.startDate)}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted">Due</div>
            <div className={late ? "font-semibold text-red-500" : "font-semibold text-heading"}>{formatDate(project.dueDate)}</div>
          </div>
        </div>
        {project.description && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm text-fg">{project.description}</p>}
      </div>

      <StageTimeline stage={project.stage} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <ChatThread
            endpoint={`/api/projects/${project._id}/messages`}
            side="team"
            title="Client chat"
            subtitle="The client sees this conversation on their portal."
            uploads={!!process.env.BLOB_READ_WRITE_TOKEN}
          />
          <ClientUpdatePanel project={project} />
          <IssuesPanel project={project} team={members.map((m) => m.name)} />
          <RevisionsPanel project={project} />
          <ChecklistPanel project={project} />
          <DocumentsPanel project={project} uploads={!!process.env.BLOB_READ_WRITE_TOKEN} />
        </div>

        <div className="space-y-6">
          {(project.approvedAt || project.feedback?.rating) && (
            <div className="card space-y-3 p-5">
              {project.approvedAt && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                  <div className="text-sm">
                    <div className="font-semibold text-heading">Approved by client</div>
                    <div className="text-muted">
                      {project.approvedBy} · <LocalTime iso={project.approvedAt} />
                    </div>
                  </div>
                </div>
              )}
              {project.feedback?.rating ? (
                <div className="flex items-start gap-3">
                  <Star className="mt-0.5 h-5 w-5 fill-amber-400 text-amber-400" />
                  <div className="text-sm">
                    <div className="font-semibold text-heading">Feedback: {project.feedback.rating}/5</div>
                    {project.feedback.comment && <p className="text-muted">&ldquo;{project.feedback.comment}&rdquo;</p>}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-heading">
              <Users className="h-4 w-4 text-brand dark:text-[#8f9bff]" /> Team
            </h2>
            {members.length === 0 ? (
              <p className="text-sm text-red-500">No one is assigned. {isOwner ? "Use Edit to assign the team." : ""}</p>
            ) : (
              <ul className="space-y-2.5">
                {members.map((m) => (
                  <li key={m._id} className="flex items-center gap-3">
                    <Avatar name={m.name} />
                    <div className="min-w-0 text-sm">
                      <div className="font-semibold text-heading">{m.name}</div>
                      <div className="truncate text-xs text-muted">{m.email}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {client && (
            <div className="card p-5">
              <h2 className="mb-2 font-bold text-heading">Client contact</h2>
              <div className="divide-y divide-line">
                <InfoRow label="Name" value={client.name} />
                <InfoRow label="Email" value={client.email && <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Mail className="h-3.5 w-3.5" />{client.email}</a>} />
                <InfoRow label="Phone" value={client.phone && <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Phone className="h-3.5 w-3.5" />{client.phone}</a>} />
                <InfoRow label="Domain" value={project.domain} />
                <InfoRow
                  label="Stage since"
                  value={project.stageChangedAt && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /><LocalTime iso={project.stageChangedAt} dateOnly /></span>}
                />
              </div>
            </div>
          )}

          <NotesPanel project={project} />
          <ActivityFeed items={activity} />
        </div>
      </div>
    </div>
  );
}
