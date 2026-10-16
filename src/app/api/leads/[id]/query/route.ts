import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { Lead } from "@/models/Lead";
import { Query } from "@/models/Query";

type Ctx = { params: Promise<{ id: string }> };

/** An interested lead becomes a Pending query (no client yet), linked back to the lead. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Lead not found", 404);
  await dbConnect();
  const lead = await Lead.findById(id).populate("list", "name source");
  if (!lead) return error("Lead not found", 404);
  if (lead.query && (await Query.exists({ _id: lead.query }))) return json({ queryId: String(lead.query), existed: true });
  const source = lead.list?.source || "LinkedIn";
  const q = await Query.create({
    client: null,
    lead: { name: lead.name || lead.company || "Lead", email: lead.email, phone: lead.phone, company: lead.company, source, page: lead.linkedin },
    title: `${source} lead${lead.company ? `: ${lead.company}` : ""}`,
    description: [lead.title && `Title: ${lead.title}`, lead.location && `Location: ${lead.location}`, lead.notes].filter(Boolean).join("\n"),
    status: "Pending",
    priority: lead.status === "Interested" ? "High" : "Medium",
    assignedTo: user.role === "team_admin" ? user.name : undefined,
  });
  lead.query = q._id;
  await lead.save();
  return json({ queryId: String(q._id) }, 201);
});
