import { dbConnect } from "@/lib/db";
import { Project } from "@/models/Project";
import { Activity } from "@/models/Activity";
import { Client } from "@/models/Client";
import { error, handle, json, pick, validId } from "@/lib/api";
import { ADMIN, STAFF, apiUser } from "@/lib/session";
import { isStage, logActivity, projectFor, setStage, validTeam } from "@/lib/projects";
import { clientUserIds, notify } from "@/lib/notify";
import { PROJECT_FIELDS, cleanProject } from "@/lib/fields";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  const project = await projectFor(user, id);
  return json(project);
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  const project = await projectFor(user, id);
  const body = await req.json();
  const adminOnly = user.role === "super_admin" ? ["client", "team", "revisionLimit"] : [];
  const data = cleanProject(pick(body, [...PROJECT_FIELDS, ...adminOnly]));
  if ("title" in data && !data.title) return error("Project title is required");
  if ("client" in data) {
    if (!validId(String(data.client)) || !(await Client.exists({ _id: data.client }))) return error("Client not found");
  }

  const nextStage = data.stage;
  delete data.stage;
  if (nextStage !== undefined && !isStage(nextStage)) return error("Invalid stage");

  let addedTeam: string[] = [];
  if ("team" in data) {
    const before = (project.team || []).map(String);
    data.team = await validTeam(data.team);
    addedTeam = (data.team as string[]).filter((t) => !before.includes(t) && t !== user.id);
  }

  const updateChanged = "clientUpdate" in data && (data.clientUpdate || "") !== (project.clientUpdate || "");
  const previewChanged = "previewUrl" in data && data.previewUrl && data.previewUrl !== project.previewUrl;
  const progress = data.progress as number | undefined;
  if (nextStage && nextStage !== project.stage) delete data.progress;

  project.set(data);
  await project.save();

  if (nextStage) await setStage(project, nextStage, user, { progress });
  if (updateChanged && project.clientUpdate) {
    await logActivity(project, user, `Update: ${project.clientUpdate}`, true);
    await notify(await clientUserIds(String(project.client)), {
      title: `Update on ${project.title}`,
      body: project.clientUpdate,
      link: `/portal/projects/${project._id}`,
    });
  }
  if (previewChanged) await logActivity(project, user, "Preview link updated", true);
  if (addedTeam.length) {
    await logActivity(project, user, "Team updated", false);
    await notify(addedTeam, { title: `New project assigned: ${project.title}`, body: `${user.name} added you to this project.`, link: `/projects/${project._id}` });
  }
  return json(project);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Activity.deleteMany({ project: id });
  await Project.findByIdAndDelete(id);
  return json({ ok: true });
});
