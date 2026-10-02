import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";
import { Client } from "@/models/Client";
import { Query } from "@/models/Query";
import { error, handle, json, validId } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Turns an onboarding submission into a client plus a pending query. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
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
  await Query.create({
    client: client._id,
    title: services.length ? services.join(", ") : "New onboarding request",
    service: services[0] || "Other",
    description: sub.message,
    status: "Pending",
  });

  sub.client = client._id;
  sub.status = "Converted";
  await sub.save();
  return json({ clientId: String(client._id) });
});
