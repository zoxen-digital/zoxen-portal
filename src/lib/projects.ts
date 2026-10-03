import { Types } from "mongoose";
import { HttpError, validId } from "./api";
import { dbConnect } from "./db";
import { clientUserIds, notify, superAdminIds } from "./notify";
import { PROJECT_STAGES, STAGE_INFO, type ProjectStage } from "./constants";
import type { CurrentUser } from "./session";
import type { PortalProjectT, ProjectT } from "./types";
import { Activity } from "@/models/Activity";
import { Project } from "@/models/Project";
import { User } from "@/models/User";

/** Mongo filter for the projects a user may see. ObjectIds, so it also works inside aggregate $match. */
export function projectScope(user: CurrentUser): Record<string, unknown> {
  if (user.role === "super_admin") return {};
  if (user.role === "team_admin") return { team: new Types.ObjectId(user.id) };
  return { client: new Types.ObjectId(user.clientId || "000000000000000000000000") };
}

/** Loads a project the user is allowed to touch, or throws 404. */
export async function projectFor(user: CurrentUser, id: string) {
  if (!validId(id)) throw new HttpError("Project not found", 404);
  await dbConnect();
  const project = await Project.findOne({ _id: id, ...projectScope(user) });
  if (!project) throw new HttpError("Project not found", 404);
  return project;
}

export function isStage(s: unknown): s is ProjectStage {
  return PROJECT_STAGES.includes(s as ProjectStage);
}

export function clientStage(stage: string) {
  return STAGE_INFO[stage as ProjectStage]?.client || "In Progress";
}

export async function logActivity(
  project: { _id: unknown; client: unknown },
  actor: CurrentUser | { name: string; role: string },
  text: string,
  visibleToClient = false
) {
  try {
    await Activity.create({
      project: project._id,
      client: project.client,
      actor: actor.name,
      actorRole: actor.role,
      text,
      visibleToClient,
    });
  } catch (e) {
    console.error("Activity log failed:", e);
  }
}

/** Everyone on the staff side who should hear about a project: its team plus the owners. */
export async function staffFor(project: { team?: unknown[] }, except?: string) {
  const ids = [...(project.team || []).map(String), ...(await superAdminIds())];
  return [...new Set(ids)].filter((id) => id !== except);
}

const CLIENT_MESSAGES: Partial<Record<ProjectStage, { title: (t: string) => string; body: string; email?: boolean }>> = {
  Approved: { title: (t) => `${t}: project started`, body: "Your project is approved and our team has started work." },
  "In Progress": { title: (t) => `${t}: work in progress`, body: "Our team is working on your project." },
  "Client Review": {
    title: (t) => `${t} is ready for your review`,
    body: "Please review it and either approve it or request changes from your portal.",
    email: true,
  },
  Revision: { title: (t) => `${t}: revisions in progress`, body: "We are working on the changes you requested." },
  Launch: { title: (t) => `${t}: preparing launch`, body: "We are preparing the final launch and delivery." },
  Live: { title: (t) => `${t} is live`, body: "Your project is now live. Thank you for working with us.", email: true },
  Completed: { title: (t) => `${t} completed`, body: "Your project is complete. We would love your feedback in the portal.", email: true },
  "On Hold": { title: (t) => `${t}: on hold`, body: "Your project is on hold. Check your portal for details." },
};

/**
 * Moves a project to a new stage: resets progress to the stage default (unless given),
 * logs it, and tells the client when what they see changes.
 */
export async function setStage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any,
  stage: ProjectStage,
  actor: CurrentUser,
  /** silent: the caller sends its own, more specific notification instead. */
  opts: { progress?: number; silent?: boolean } = {}
) {
  const prev = project.stage as ProjectStage;
  if (prev === stage) return false;
  project.stage = stage;
  project.stageChangedAt = new Date();
  const defaultProgress = STAGE_INFO[stage].progress;
  // On Hold / Blocked keep whatever progress was reached.
  if (opts.progress !== undefined) project.progress = opts.progress;
  else if (defaultProgress > 0) project.progress = defaultProgress;
  await project.save();

  const clientChanged = clientStage(prev) !== clientStage(stage);
  await logActivity(project, actor, `Stage changed from ${prev} to ${stage}`, false);
  if (clientChanged) await logActivity(project, actor, `Status updated to "${clientStage(stage)}"`, true);

  const link = `/portal/projects/${project._id}`;
  const msg = CLIENT_MESSAGES[stage];
  if (opts.silent) return true;
  if (clientChanged && msg) {
    await notify(await clientUserIds(String(project.client)), {
      title: msg.title(project.title),
      body: msg.body,
      link,
      email: msg.email ? { button: stage === "Client Review" ? "Review now" : "Open portal" } : undefined,
    });
  }
  if (actor.role !== "super_admin" || stage === "Blocked") {
    await notify(await staffFor(project, actor.id), {
      title: `${project.title}: ${stage}`,
      body: `${actor.name} moved it from ${prev} to ${stage}.`,
      link: `/projects/${project._id}`,
    });
  }
  return true;
}

/** Keeps only ids of real staff accounts (team admins or super admins). */
export async function validTeam(team: unknown) {
  const ids = (Array.isArray(team) ? team : []).map(String).filter(validId);
  if (!ids.length) return [];
  const found = await User.find({ _id: { $in: ids }, role: { $in: ["team_admin", "super_admin"] } }).select("_id").lean();
  return found.map((u) => String(u._id));
}

/** Strips everything internal before a project goes to the client portal. */
export function toPortal(p: ProjectT): PortalProjectT {
  return {
    _id: p._id,
    title: p.title,
    service: p.service,
    description: p.description,
    stage: clientStage(p.stage),
    inReview: p.stage === "Client Review",
    progress: p.progress,
    startDate: p.startDate,
    dueDate: p.dueDate,
    previewUrl: p.previewUrl,
    liveUrl: p.liveUrl,
    domain: p.domain,
    clientUpdate: p.clientUpdate,
    revisionLimit: p.revisionLimit,
    checklist: (p.checklist || []).map((c) => ({ label: c.label, done: c.done })),
    actionsNeeded: (p.issues || [])
      .filter((i) => i.visibleToClient && i.status !== "Resolved")
      .map((i) => ({ _id: i._id, title: i.title, details: i.details, dueDate: i.dueDate })),
    revisions: p.revisions || [],
    documents: (p.documents || []).filter((d) => d.visibleToClient),
    approvedAt: p.approvedAt,
    feedback: p.feedback,
    team: (p.team || []).map((t) => (typeof t === "string" ? "" : t.name.split(" ")[0]!)).filter(Boolean),
    updatedAt: p.updatedAt,
  };
}
