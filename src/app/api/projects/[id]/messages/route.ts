import { handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { projectFor } from "@/lib/projects";
import { listMessages, postMessage } from "@/lib/messages";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  const project = await projectFor(user, id);
  return json(await listMessages({ project: String(project._id) }));
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  const project = await projectFor(user, id);
  return json(await postMessage({ kind: "project", doc: project }, user, await req.json().catch(() => ({}))), 201);
});
