import { dbConnect } from "@/lib/db";
import { Project } from "@/models/Project";
import { Client } from "@/models/Client";
import { error, handle, json, pick, validId } from "@/lib/api";
import { ADMIN, STAFF, apiUser } from "@/lib/session";
import { isStage, logActivity, projectScope, validTeam } from "@/lib/projects";
import { clientUserIds, notify } from "@/lib/notify";
import { DEFAULT_CHECKLIST, STAGE_INFO } from "@/lib/constants";
import { PROJECT_FIELDS, cleanProject } from "@/lib/fields";

export const GET = handle(async () => {
  const user = await apiUser(STAFF);
  await dbConnect();
  const projects = await Project.find(projectScope(user)).sort({ updatedAt: -1 }).limit(500).populate("client", "name company").lean();
  return json(projects);
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser(ADMIN);
  await dbConnect();
  const body = await req.json();
  const data = cleanProject(pick(body, [...PROJECT_FIELDS, "client", "team", "revisionLimit"]));
  if (!data.title) return error("Project title is required");
  if (!data.client || !validId(String(data.client))) return error("Please select a client");
  if (!(await Client.exists({ _id: data.client }))) return error("Client not found");
  const stage = isStage(data.stage) ? data.stage : "Onboarding";
  data.stage = stage;
  if (data.progress === undefined) data.progress = STAGE_INFO[stage].progress;
  data.team = await validTeam(data.team);

  const isWeb = /web|e-commerce|app|ui/i.test(String(data.service || ""));
  const checklist = body.useDefaultChecklist === false ? [] : DEFAULT_CHECKLIST[isWeb ? "website" : "other"]!.map((label) => ({ label }));

  const project = await Project.create({ ...data, checklist });
  await logActivity(project, user, "Project created", false);
  await logActivity(project, user, "Project added to your portal", true);

  const team = (data.team as string[]).filter((id) => id !== user.id);
  await notify(team, { title: `New project assigned: ${project.title}`, body: "You have been added to this project.", link: `/projects/${project._id}` });
  await notify(await clientUserIds(String(project.client)), {
    title: `New project: ${project.title}`,
    body: "You can follow its progress in your portal.",
    link: `/portal/projects/${project._id}`,
  });
  return json(project, 201);
});
