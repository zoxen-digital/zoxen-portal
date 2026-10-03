import { dbConnect } from "@/lib/db";
import { Package } from "@/models/Package";
import { Client } from "@/models/Client";
import { Quote } from "@/models/Quote";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { addDays, lineTotals, nextNumber } from "@/lib/docs";
import { newPublicId } from "@/lib/invoices";
import { getSettings } from "@/lib/settings";
import { createInvoice, createProject } from "@/lib/fulfil";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Uses a package for a client. Body: { client, mode }
 *  mode "quote"   -> a draft quote prefilled from the package (review, then send)
 *  mode "project" -> project (with checklist and timeline) + invoice right away
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Package not found", 404);
  await dbConnect();
  const pkg = await Package.findById(id).lean<{
    _id: unknown;
    name: string;
    service?: string;
    description?: string;
    items: { description: string; details?: string; qty: number; unit?: string; rate: number }[];
    currency: string;
    checklist: string[];
    revisionLimit: number;
    durationDays: number;
  }>();
  if (!pkg) return error("Package not found", 404);
  const { client, mode } = await req.json().catch(() => ({}));
  if (!client || !validId(String(client)) || !(await Client.exists({ _id: client }))) return error("Choose a client");

  const settings = await getSettings();
  const lines = { items: pkg.items, extraCosts: [], discountType: "fixed" as const, discountValue: 0, taxPercent: settings.defaultTaxPercent || 0, currency: pkg.currency };

  if (mode === "quote") {
    const quote = await Quote.create({
      ...lines,
      number: await nextNumber(Quote, "Q"),
      publicId: newPublicId(),
      client,
      title: pkg.name,
      intro: pkg.description,
      totals: lineTotals(lines),
      validUntil: addDays(new Date(), 14),
      terms: settings.defaultTerms,
      status: "Draft",
      package: pkg._id,
      projectSetup: { service: pkg.service, checklist: pkg.checklist, revisionLimit: pkg.revisionLimit, durationDays: pkg.durationDays },
    });
    return json({ quoteId: String(quote._id) }, 201);
  }

  const project = await createProject(
    {
      client: String(client),
      title: pkg.name,
      service: pkg.service,
      description: pkg.description,
      checklist: pkg.checklist,
      revisionLimit: pkg.revisionLimit,
      durationDays: pkg.durationDays,
    },
    user
  );
  const invoice = await createInvoice({ ...lines, client: String(client), summary: pkg.name }, user);
  return json({ projectId: String(project._id), invoiceId: String(invoice._id) }, 201);
});
