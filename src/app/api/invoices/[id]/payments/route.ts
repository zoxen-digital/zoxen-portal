import { ADMIN, apiUser } from "@/lib/session";
import { notifyClient, paymentReceivedMessage } from "@/lib/client-notify";
import { dbConnect } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { error, handle, json, validId } from "@/lib/api";
import { applyTotals } from "@/lib/invoices";

type Ctx = { params: Promise<{ id: string }> };

/** Record a payment. Send { amount, date, method, note } or { full: true } to clear the balance. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const invoice = await Invoice.findById(id);
  if (!invoice) return error("Invoice not found", 404);

  const body = await req.json();
  const amount = body.full ? Number(invoice.totals?.balance) : Number(body.amount);
  if (!amount || amount <= 0) return error("Enter a valid payment amount");

  invoice.payments.push({
    amount,
    date: body.date ? new Date(body.date) : new Date(),
    method: String(body.method || "Bank Transfer"),
    note: String(body.note || ""),
  });
  if (invoice.status === "Draft" || invoice.status === "Cancelled") invoice.status = "Unpaid";
  applyTotals(invoice);
  await invoice.save();
  await notifyClient(String(invoice.client), paymentReceivedMessage(invoice, amount), user);
  return json(invoice);
});

/** Remove a payment by its position: { index } */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const invoice = await Invoice.findById(id);
  if (!invoice) return error("Invoice not found", 404);

  const { index } = await req.json();
  if (typeof index !== "number" || index < 0 || index >= invoice.payments.length) return error("Payment not found");
  invoice.payments.splice(index, 1);
  applyTotals(invoice);
  await invoice.save();
  return json(invoice);
});
