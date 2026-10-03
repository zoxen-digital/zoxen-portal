import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { Project } from "@/models/Project";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { logActivity } from "@/lib/projects";
import { DEFAULT_CHECKLIST, STAGE_INFO } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/** Turns an onboarding submission into a client, a pending query and a project in the Onboarding stage. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const sub = await Onboarding.findById(id);
  if (!sub) return error("Submission not found", 404);
  if (sub.client) return json({ clientId: String(sub.client) });

  const client = await Client.create({
    name: sub.name,
    company: sub.company,
    email: sub.email,
    phone: sub.phone,
    website: sub.website,
    source: "Onboarding Form",
    status: "Onboarding",
    notes: sub.budget ? `Budget: ${sub.budget}` : undefined,
  });

  const services: string[] = sub.services || [];
  const title = services.length ? services.join(", ") : "New onboarding request";
  const service = services[0] || "Other";
  const query = await Query.create({
    client: client._id,
    title,
    service,
    description: sub.message,
    status: "Pending",
  });

  const isWeb = /web|e-commerce|app|ui/i.test(service);
  const project = await Project.create({
    client: client._id,
    title: sub.company ? `${sub.company}: ${title}` : title,
    service,
    description: sub.message,
    stage: "Onboarding",
    progress: STAGE_INFO.Onboarding.progress,
    domain: sub.website,
    onboarding: sub._id,
    query: query._id,
    checklist: DEFAULT_CHECKLIST[isWeb ? "website" : "other"]!.map((label) => ({ label })),
  });
  await logActivity(project, user, "Project created from onboarding form", false);

  sub.client = client._id;
  sub.status = "Converted";
  await sub.save();
  return json({ clientId: String(client._id), projectId: String(project._id) });
});
