import { STAFF, apiUser } from "@/lib/session";
import { notifyClient } from "@/lib/client-notify";
import { logActivity, projectFor } from "@/lib/projects";
import { error, handle, json } from "@/lib/api";
import { followUpBody } from "@/lib/fields";

type Ctx = { params: Promise<{ id: string }> };

/** Follow-up to the client about one project (team members can send these too). Body: { title, message, email } */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  const project = await projectFor(user, id);
  const m = followUpBody(await req.json().catch(() => ({})));
  const via = await notifyClient(String(project.client), { ...m, link: `/portal/projects/${project._id}`, button: "Open project" }, user);
  if (via === "none") return error("This client has no portal login, and no email could be sent. Ask the owner to invite them to the portal.");
  await logActivity(project, user, `Follow-up sent: ${m.title}`, false);
  return json({ ok: true, via });
});
