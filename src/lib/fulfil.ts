import { addDays } from "./docs";
import { clientSnapshot, newPublicId, nextInvoiceNumber, recompute } from "./invoices";
import { getSettings } from "./settings";
import { invoiceIssuedMessage, notifyClient } from "./client-notify";
import { logActivity } from "./projects";
import { clientUserIds, notify } from "./notify";
import { DEFAULT_CHECKLIST, STAGE_INFO } from "./constants";
import type { ExtraCost, InvoiceItem } from "./types";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";

type Actor = { id?: string; name: string; role: string };

type InvoiceInput = {
  client: string;
  items: InvoiceItem[];
  extraCosts?: ExtraCost[];
  discountType: "fixed" | "percent";
  discountValue: number;
  taxPercent: number;
  currency: string;
  summary?: string;
  notes?: string;
  terms?: string;
  dueDays?: number;
};

/** Creates a live (Unpaid) invoice with the usual defaults and tells the client. */
export async function createInvoice(input: InvoiceInput, actor: Actor, opts: { notify?: boolean } = {}) {
  const [settings, client] = await Promise.all([getSettings(), Client.findById(input.client).lean()]);
  if (!client) throw new Error("Client not found");
  const issueDate = new Date();
  const base = {
    items: input.items,
    extraCosts: input.extraCosts || [],
    discountType: input.discountType,
    discountValue: input.discountValue,
    taxPercent: input.taxPercent,
    payments: [],
    status: "Unpaid",
  };
  const computed = recompute(base);
  const invoice = await Invoice.create({
    ...base,
    ...computed,
    client: input.client,
    clientSnapshot: clientSnapshot(client),
    requirement: { summary: input.summary || "", tags: [] },
    currency: input.currency,
    issueDate,
    dueDate: addDays(issueDate, input.dueDays ?? settings.defaultDueDays ?? 7),
    notes: input.notes ?? settings.defaultNotes ?? "",
    terms: input.terms ?? settings.defaultTerms ?? "",
    paymentDetails: settings.paymentDetails || {},
    invoiceNumber: await nextInvoiceNumber(settings.invoicePrefix),
    publicId: newPublicId(),
  });
  if (opts.notify !== false) await notifyClient(String(input.client), invoiceIssuedMessage(invoice), actor);
  return invoice;
}

type ProjectInput = {
  client: string;
  title: string;
  service?: string;
  description?: string;
  checklist?: string[];
  revisionLimit?: number;
  durationDays?: number;
  quote?: unknown;
};

/** Starts a project in the Approved stage and tells the client it is on their portal. */
export async function createProject(input: ProjectInput, actor: Actor & { id: string }) {
  const isWeb = /web|e-commerce|app|ui/i.test(input.service || "");
  const checklist = input.checklist?.length ? input.checklist : DEFAULT_CHECKLIST[isWeb ? "website" : "other"]!;
  const project = await Project.create({
    client: input.client,
    title: input.title,
    service: input.service,
    description: input.description,
    stage: "Approved",
    progress: STAGE_INFO.Approved.progress,
    startDate: new Date(),
    dueDate: input.durationDays ? addDays(new Date(), input.durationDays) : undefined,
    revisionLimit: input.revisionLimit ?? 2,
    checklist: checklist.map((label) => ({ label })),
  });
  await logActivity(project, actor, "Project created", false);
  await logActivity(project, actor, "Project started", true);
  await notify(await clientUserIds(input.client), {
    title: `Project started: ${project.title}`,
    body: "Your project is approved and our team has started work. Follow every step in your portal.",
    link: `/portal/projects/${project._id}`,
  });
  return project;
}
