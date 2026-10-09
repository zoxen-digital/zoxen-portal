import { ADMIN, apiUser } from "@/lib/session";
import { invoiceIssuedMessage, notifyClient } from "@/lib/client-notify";
import { dbConnect } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { Client } from "@/models/Client";
import { error, handle, json, validId } from "@/lib/api";
import { applyTotals, clientSnapshot, normalizeInvoiceBody } from "@/lib/invoices";
import { unlockOnboardingIfPaid } from "@/lib/onboarding-unlock";
import { INVOICE_STATUSES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/** Full edit from the invoice form. Recorded payments are kept as they are. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const invoice = await Invoice.findById(id);
  if (!invoice) return error("Invoice not found", 404);

  const body = await req.json();
  const data = normalizeInvoiceBody(body);
  if (data.items.length === 0) return error("Add at least one line item");

  if (body.client && validId(body.client) && String(invoice.client) !== body.client) {
    const client = await Client.findById(body.client).lean();
    if (!client) return error("Client not found");
    invoice.client = body.client;
    invoice.clientSnapshot = clientSnapshot(client);
  }

  const wasDraft = invoice.status === "Draft";
  invoice.set(data);
  if (body.status === "Draft") invoice.status = "Draft";
  else if (invoice.status === "Draft") invoice.status = "Unpaid";

  // Payment status chosen in the edit form: keep payments, reset to unpaid, or mark fully paid.
  if (body.paymentAction === "unpaid") invoice.payments = [];
  applyTotals(invoice);
  if (body.paymentAction === "paid" && invoice.totals.balance > 0) {
    invoice.payments.push({ amount: invoice.totals.balance, date: new Date(), method: "Bank Transfer", note: "Marked as paid" });
    if (invoice.status === "Draft") invoice.status = "Unpaid";
    applyTotals(invoice);
  }
  await invoice.save();
  if (wasDraft && invoice.status !== "Draft") await notifyClient(String(invoice.client), invoiceIssuedMessage(invoice), user);
  await unlockOnboardingIfPaid(invoice, user);
  return json(invoice);
});

/** Quick actions: change status, clear all payments (mark unpaid) or refresh client details. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const invoice = await Invoice.findById(id);
  if (!invoice) return error("Invoice not found", 404);

  const { status, refreshClient, clearPayments } = await req.json();
  const wasDraft = invoice.status === "Draft";
  if (clearPayments) invoice.payments = [];
  if (status) {
    if (!(INVOICE_STATUSES as readonly string[]).includes(status)) return error("Invalid status");
    invoice.status = status === "Draft" || status === "Cancelled" ? status : "Unpaid";
  }
  if (refreshClient) {
    const client = await Client.findById(invoice.client).lean();
    if (client) invoice.clientSnapshot = clientSnapshot(client);
  }
  applyTotals(invoice);
  await invoice.save();
  if (wasDraft && invoice.status === "Unpaid") await notifyClient(String(invoice.client), invoiceIssuedMessage(invoice), user);
  return json(invoice);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Invoice.findByIdAndDelete(id);
  return json({ ok: true });
});
