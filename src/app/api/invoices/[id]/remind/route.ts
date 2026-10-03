import { ADMIN, apiUser } from "@/lib/session";
import { invoiceReminderMessage, notifyClient } from "@/lib/client-notify";
import { dbConnect } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { error, handle, json, validId } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Sends the client a payment reminder (portal + push + email). Body: { note? } */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const invoice = await Invoice.findById(id);
  if (!invoice) return error("Invoice not found", 404);
  if (["Draft", "Cancelled"].includes(invoice.status)) return error("Generate the invoice first");
  if (!(invoice.totals?.balance > 0)) return error("This invoice is already paid");

  const { note } = await req.json().catch(() => ({}));
  const via = await notifyClient(String(invoice.client), invoiceReminderMessage(invoice, typeof note === "string" ? note.trim().slice(0, 500) : ""), user);
  if (via === "none") return error("The client has no portal login and no email address (or email is not set up). Share the invoice link on WhatsApp instead.");

  invoice.lastReminderAt = new Date();
  invoice.reminderCount = (invoice.reminderCount || 0) + 1;
  await invoice.save();
  return json({ ok: true, via });
});
