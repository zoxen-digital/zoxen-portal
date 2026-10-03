import Link from "next/link";
import { AlertTriangle, Eye, RefreshCcw, Rocket, Timer } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { STAFF, pageUser } from "@/lib/session";
import { projectScope } from "@/lib/projects";
import { Client } from "@/models/Client";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { SearchBox, StatusTabs } from "@/components/Filters";
import { StatusSelect } from "@/components/actions";
import { NewProjectButton, ProgressBar, type TeamOption } from "@/components/ProjectForm";
import { OPEN_STAGES, PROJECT_STAGES } from "@/lib/constants";
import { escapeRegex, formatDate, isOverdue, serialize } from "@/lib/utils";
import type { ClientT, ProjectT } from "@/lib/types";
import type { ClientOption } from "@/components/QueryForm";

export const metadata = { title: "Projects" };

type SP = Promise<{ q?: string; status?: string; member?: string }>;

const TABS = ["Active", ...PROJECT_STAGES, "Overdue"];

export default async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const user = await pageUser(STAFF);
  const isOwner = user.role === "super_admin";
  const sp = await searchParams;
  await dbConnect();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scope = projectScope(user);
  const filter: Record<string, unknown> = { ...scope };
  if (sp.status === "Active") filter.stage = { $in: OPEN_STAGES };
  else if (sp.status === "Overdue") Object.assign(filter, { stage: { $in: OPEN_STAGES }, dueDate: { $lt: today } });
  else if (sp.status) filter.stage = sp.status;
  if (isOwner && sp.member) filter.team = sp.member;
  if (sp.q) {
    const rx = { $regex: escapeRegex(sp.q), $options: "i" };
    const matching = await Client.find({ $or: [{ name: rx }, { company: rx }] }).select("_id").lean();
    filter.$or = [{ title: rx }, { service: rx }, { domain: rx }, { client: { $in: matching.map((c) => c._id) } }];
  }

  const [docs, stageAgg, overdue, clientDocs, teamDocs] = await Promise.all([
    Project.find(filter).sort({ updatedAt: -1 }).limit(500).populate("client", "name company").populate("team", "name").lean(),
    Project.aggregate([{ $match: scope }, { $group: { _id: "$stage", n: { $sum: 1 } } }]),
    Project.countDocuments({ ...scope, stage: { $in: OPEN_STAGES }, dueDate: { $lt: today } }),
    isOwner ? Client.find().sort({ name: 1 }).select("name company").lean() : [],
    isOwner ? User.find({ role: { $in: ["team_admin", "super_admin"] }, status: { $ne: "disabled" } }).sort({ name: 1 }).select("name title").lean() : [],
  ]);

  const projects = serialize<ProjectT[]>(docs);
  const clients = serialize<ClientOption[]>(clientDocs);
  const team = serialize<TeamOption[]>(teamDocs);
  const counts: Record<string, number> = { All: 0, Active: 0, Overdue: overdue };
  for (const s of stageAgg as { _id: string; n: number }[]) {
    counts[s._id] = s.n;
    counts.All! += s.n;
    if ((OPEN_STAGES as string[]).includes(s._id)) counts.Active! += s.n;
  }

  return (
    <div>
      <PageHeader
        title={isOwner ? "Projects" : "My Projects"}
        subtitle="Every project from onboarding to live. Clients see the status on their portal in real time."
      >
        {isOwner && <NewProjectButton clients={clients} team={team} />}
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Rocket} label="Active projects" value={counts.Active || 0} tone="blue" href="/projects?status=Active" />
        <StatCard icon={Eye} label="Waiting on client review" value={counts["Client Review"] || 0} tone="violet" href="/projects?status=Client+Review" />
        <StatCard icon={RefreshCcw} label="In revision" value={counts.Revision || 0} tone="amber" href="/projects?status=Revision" />
        <StatCard
          icon={(counts.Blocked || 0) > 0 ? AlertTriangle : Timer}
          label="Blocked / overdue"
          value={`${counts.Blocked || 0} / ${overdue}`}
          tone={(counts.Blocked || 0) + overdue > 0 ? "red" : "slate"}
          href={(counts.Blocked || 0) > 0 ? "/projects?status=Blocked" : "/projects?status=Overdue"}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <StatusTabs basePath="/projects" current={sp.status} options={TABS} params={sp} counts={counts} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isOwner && team.length > 0 && (
            <form action="/projects" className="flex gap-2">
              {sp.status && <input type="hidden" name="status" value={sp.status} />}
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              <select name="member" defaultValue={sp.member || ""} className="input w-44">
                <option value="">All team members</option>
                {team.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
              <button className="btn btn-outline">Filter</button>
            </form>
          )}
          <SearchBox action="/projects" defaultValue={sp.q} placeholder="Search project or client..." hidden={{ status: sp.status, member: sp.member }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {projects.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No projects found"
            text={isOwner ? "Create a project, or convert an onboarding submission." : "Projects assigned to you will show up here."}
          />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Stage</th>
                  <th>Progress</th>
                  <th>Team</th>
                  <th>Due</th>
                  <th>Open items</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const c = p.client as ClientT | null;
                  const done = ["Live", "Completed"].includes(p.stage);
                  const late = isOverdue(p.dueDate, done);
                  const openIssues = p.issues.filter((i) => i.status !== "Resolved").length;
                  const openRevs = p.revisions.filter((r) => r.status !== "Done").length;
                  const checklistDone = p.checklist.filter((i) => i.done).length;
                  return (
                    <tr key={p._id}>
                      <td>
                        <Link href={`/projects/${p._id}`} className="group block min-w-[220px]">
                          <div className="font-semibold text-heading group-hover:text-brand">{p.title}</div>
                          <div className="text-xs text-muted">
                            {c ? c.company || c.name : "Deleted client"}
                            {p.service ? ` · ${p.service}` : ""}
                          </div>
                        </Link>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <StatusSelect url={`/api/projects/${p._id}`} value={p.stage} options={PROJECT_STAGES} field="stage" />
                          {late && <Badge status="Overdue" />}
                        </div>
                      </td>
                      <td className="min-w-[140px]">
                        <div className="mb-1 flex justify-between text-xs text-muted">
                          <span>{p.progress}%</span>
                          {p.checklist.length > 0 && <span>{checklistDone}/{p.checklist.length} tasks</span>}
                        </div>
                        <ProgressBar value={p.progress} />
                      </td>
                      <td>
                        {p.team.length === 0 ? (
                          <span className="text-sm text-red-500">Unassigned</span>
                        ) : (
                          <div className="flex -space-x-2">
                            {p.team.slice(0, 4).map((t) =>
                              typeof t === "string" ? null : <Avatar key={t._id} name={t.name} className="ring-2 ring-[var(--surface)]" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className={`whitespace-nowrap ${late ? "font-semibold text-red-500" : "text-muted"}`}>{formatDate(p.dueDate)}</td>
                      <td className="whitespace-nowrap text-xs">
                        {openIssues > 0 && <span className="mr-2 font-semibold text-amber-600">{openIssues} issue{openIssues > 1 ? "s" : ""}</span>}
                        {openRevs > 0 && <span className="font-semibold text-orange-600">{openRevs} revision{openRevs > 1 ? "s" : ""}</span>}
                        {!openIssues && !openRevs && <span className="text-muted">—</span>}
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
