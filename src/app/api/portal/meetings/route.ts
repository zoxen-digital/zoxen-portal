import { dbConnect } from "@/lib/db";
import { Meeting } from "@/models/Meeting";
import { Project } from "@/models/Project";
import { Client } from "@/models/Client";
import { Activity } from "@/models/Activity";
import { error, handle, json, validId } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { notify, superAdminIds } from "@/lib/notify";

/** Client asks for a meeting from the portal. Body: { title, date (ISO), notes?, project? } */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["client"]);
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return error("What is the meeting about?");
  const date = new Date(String(body.date || ""));
  if (isNaN(date.getTime())) return error("Choose a preferred date and time");
  if (date.getTime() < Date.now()) return error("Choose a time in the future");
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";

  await dbConnect();
  let project = null;
  if (body.project && validId(String(body.project))) {
    project = await Project.findOne({ _id: body.project, client: user.clientId }).select("title team").lean<{ _id: unknown; title: string; team?: unknown[] }>();
  }
  // Only one open request at a time keeps the inbox clean.
  const open = await Meeting.countDocuments({ client: user.clientId, status: "Requested" });
  if (open >= 3) return error("You already have meeting requests waiting. Our team will confirm them shortly.");

  const meeting = await Meeting.create({
    client: user.clientId,
    project: project?._id,
    title,
    date,
    notes,
    status: "Requested",
    createdBy: user.name,
  });

  const client = await Client.findById(user.clientId).select("name company").lean<{ name: string; company?: string }>();
  await Activity.create({
    client: user.clientId,
    project: project?._id,
    actor: user.name,
    actorRole: "client",
    text: `Meeting requested: ${title}`,
    visibleToClient: true,
  });
  const who = client?.company || client?.name || user.name;
  const admins = await superAdminIds();
  await notify(admins, {
    title: `Meeting request from ${who}`,
    body: `${title}${project ? ` (${project.title})` : ""}. Confirm or decline it on the client page.`,
    link: `/clients/${user.clientId}`,
    email: { button: "Review request" },
  });
  // The project team hears about it too, but cannot open the client page.
  const team = (project?.team || []).map(String).filter((id) => !admins.includes(id));
  if (project && team.length) {
    await notify(team, { title: `Meeting request from ${who}`, body: `${title} (${project.title})`, link: `/projects/${project._id}` });
  }
  return json(meeting, 201);
});
