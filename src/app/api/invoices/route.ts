import { ADMIN, apiUser } from "@/lib/session";
import { dbConnect } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { Client } from "@/models/Client";
import { error, handle, json, validId } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { clientSnapshot, newPublicId, nextInvoiceNumber, normalizeInvoiceBody, recompute } from "@/lib/invoices";

export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const body = await req.json();
  if (!body.client || !validId(body.client)) return error("Please select a client");

  const client = await Client.findById(body.client).lean();
  if (!client) return error("Client not found");

  const data = normalizeInvoiceBody(body);
  if (data.items.length === 0) return error("Add at least one line item");

  const settings = await getSettings();
  const advance = Number(body.advancePaid) || 0;
  const payments =
    advance > 0
      ? [{ amount: advance, date: data.issueDate, method: String(body.advanceMethod || "Bank Transfer"), note: "Advance payment" }]
      : [];
  const status = body.status === "Draft" ? "Draft" : "Unpaid";
  const computed = recompute({ ...data, payments, status });

  const invoice = await Invoice.create({
    ...data,
    client: body.client,
    query: body.query && validId(body.query) ? body.query : undefined,
    clientSnapshot: clientSnapshot(client),
    invoiceNumber: await nextInvoiceNumber(settings.invoicePrefix),
    publicId: newPublicId(),
    payments,
    ...computed,
  });
  return json(invoice, 201);
});
