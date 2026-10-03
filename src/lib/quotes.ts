import { HttpError, validId } from "./api";
import { lineTotals, normalizeLines } from "./docs";
import { createInvoice, createProject } from "./fulfil";
import { notify, superAdminIds } from "./notify";
import { notifyClient } from "./client-notify";
import { formatMoney } from "./utils";
import { Activity } from "@/models/Activity";
import { Quote } from "@/models/Quote";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Cleans the quote form payload. */
export function quoteData(body: any) {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) throw new HttpError("Quote title is required");
  const lines = normalizeLines(body);
  if (!lines.items.length) throw new HttpError("Add at least one line item");
  const checklist = (Array.isArray(body.checklist) ? body.checklist : String(body.checklist || "").split("\n"))
    .map((s: unknown) => String(s).trim())
    .filter(Boolean)
    .slice(0, 50);
  return {
    ...lines,
    title,
    intro: typeof body.intro === "string" ? body.intro.trim().slice(0, 5000) : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    terms: typeof body.terms === "string" ? body.terms : "",
    validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
    totals: lineTotals(lines),
    projectSetup: {
      service: typeof body.service === "string" ? body.service : "",
      checklist,
      revisionLimit: Math.max(0, Math.round(Number(body.revisionLimit) || 0)),
      durationDays: Math.max(1, Math.round(Number(body.durationDays) || 14)),
    },
    package: body.package && validId(String(body.package)) ? body.package : undefined,
  };
}

export function isExpired(q: { status: string; validUntil?: Date | string | null }) {
  if (q.status !== "Sent" || !q.validUntil) return false;
  const end = new Date(q.validUntil);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

/**
 * Client accepted online: records the signature, then creates the invoice and the project.
 * Safe against double clicks: only a Sent quote can be accepted.
 */
export async function acceptQuote(found: any, sig: { name: string; ip: string; ua: string }) {
  if (found.status !== "Sent") throw new HttpError(found.status === "Accepted" ? "This quote is already accepted" : "This quote can no longer be accepted");
  if (isExpired(found)) throw new HttpError("This quote has expired. Please ask us for an updated one.");

  // Atomic Sent -> Accepted, so a double click can never create two projects and invoices.
  const quote = await Quote.findOneAndUpdate(
    { _id: found._id, status: "Sent" },
    { $set: { status: "Accepted", acceptedAt: new Date(), acceptedName: sig.name, acceptedIp: sig.ip, acceptedUA: sig.ua.slice(0, 300) } },
    { new: true }
  );
  if (!quote) throw new HttpError("This quote is already accepted");

  const actor = { id: "", name: sig.name, role: "client" };
  const client = String(quote.client);
  const setup = quote.projectSetup || {};
  const project = await createProject(
    {
      client,
      title: quote.title,
      service: setup.service,
      description: quote.intro,
      checklist: setup.checklist,
      revisionLimit: setup.revisionLimit,
      durationDays: setup.durationDays,
    },
    actor
  );
  const invoice = await createInvoice(
    {
      client,
      items: quote.items,
      extraCosts: quote.extraCosts,
      discountType: quote.discountType,
      discountValue: quote.discountValue,
      taxPercent: quote.taxPercent,
      currency: quote.currency,
      summary: `${quote.number}: ${quote.title}`,
      notes: quote.notes || undefined,
      terms: quote.terms || undefined,
    },
    actor
  );
  quote.project = project._id;
  quote.invoice = invoice._id;
  await quote.save();

  await Activity.create({ client, project: project._id, actor: sig.name, actorRole: "client", text: `Quote ${quote.number} accepted`, visibleToClient: true });
  await notify(await superAdminIds(), {
    title: `Quote accepted: ${quote.number}`,
    body: `${sig.name} accepted "${quote.title}" (${formatMoney(quote.totals?.total, quote.currency)}). Project and invoice ${invoice.invoiceNumber} were created.`,
    link: `/projects/${project._id}`,
    email: { button: "Open project" },
  });
  return { project, invoice };
}

export async function sendQuote(quote: any, actor: { name: string; role: string }) {
  quote.status = "Sent";
  quote.sentAt = new Date();
  await quote.save();
  return notifyClient(
    String(quote.client),
    {
      title: `New proposal: ${quote.title}`,
      body: `Quote ${quote.number} for ${formatMoney(quote.totals?.total, quote.currency)} is ready. Review it and accept online${
        quote.validUntil ? ` before ${new Date(quote.validUntil).toDateString()}` : ""
      }.`,
      link: `/quote/${quote.publicId}`,
      button: "View proposal",
      email: true,
    },
    actor
  );
}
