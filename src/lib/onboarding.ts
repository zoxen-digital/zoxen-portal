import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { HttpError, validId } from "./api";
import { DEFAULT_CHECKLIST, STAGE_INFO } from "./constants";
import { clientUserIds, notify } from "./notify";
import { logActivity } from "./projects";
import { OB_ADD_ONS, OB_PACKAGES, OB_PAGE_OPTIONS, OB_TEXT_FIELDS, packagePrice, type OnboardingAnswers } from "./onboarding-form";
import type { CurrentUser } from "./session";
import { Client } from "@/models/Client";
import { Project } from "@/models/Project";
import { referralConverted } from "./referrals";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------- Upload ticket for the public form ----------
// People filling the form are not logged in. The form page hands them a signed, short-lived
// ticket, and only uploads carrying a valid ticket are accepted (into onboarding/ only).

const TICKET_HOURS = 12;
const secret = () => process.env.AUTH_SECRET || "dev-only-secret-change-me-in-env-file";

export function issueUploadTicket() {
  const ts = Date.now().toString(36);
  const sig = createHmac("sha256", secret()).update(`onboarding:${ts}`).digest("base64url");
  return `${ts}.${sig}`;
}

export function validUploadTicket(ticket: unknown) {
  if (typeof ticket !== "string") return false;
  const [ts, sig] = ticket.split(".");
  if (!ts || !sig) return false;
  const age = Date.now() - parseInt(ts, 36);
  if (!(age >= 0 && age < TICKET_HOURS * 3600_000)) return false;
  const expected = createHmac("sha256", secret()).update(`onboarding:${ts}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- Client personal link ----------

export async function clientFormToken(clientId: string) {
  const c = await Client.findById(clientId).select("onboardingToken");
  if (!c) throw new HttpError("Client not found", 404);
  if (!c.onboardingToken) {
    c.onboardingToken = randomBytes(12).toString("base64url");
    await c.save();
  }
  return c.onboardingToken as string;
}

export async function clientForToken(token?: string | null) {
  if (!token || !/^[A-Za-z0-9_-]{10,40}$/.test(token)) return null;
  return Client.findOne({ onboardingToken: token }).select("name company email phone website").lean<any>();
}

// ---------- Answers ----------

const BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/onboarding\//i;
const str = (v: unknown, max = 3000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pickList = (v: unknown, allowed: string[]) => (Array.isArray(v) ? v.map(String).filter((x) => allowed.includes(x)) : []);

/** Cleans what the browser sent. Same required fields as the original form: name, email, business name. */
export function cleanAnswers(body: any): OnboardingAnswers {
  const out = {} as OnboardingAnswers;
  for (const f of OB_TEXT_FIELDS) (out as any)[f] = str(body[f], f === "email" ? 200 : 3000);
  if (!out.contactPerson || !out.email || !out.businessName) throw new HttpError("Please fill in your name, email and business name.");
  if (!/^\S+@\S+\.\S+$/.test(out.email)) throw new HttpError("Please enter a valid email address.");
  out.package = OB_PACKAGES.some((p) => p.id === body.package) ? body.package : "Premium";
  out.addOns = pickList(body.addOns, OB_ADD_ONS);
  out.pagesNeeded = pickList(body.pagesNeeded, OB_PAGE_OPTIONS);
  out.logoUrl = typeof body.logoUrl === "string" && BLOB.test(body.logoUrl) ? body.logoUrl : null;
  out.attachmentUrls = (Array.isArray(body.attachmentUrls) ? body.attachmentUrls : []).filter((u: unknown) => typeof u === "string" && BLOB.test(u)).slice(0, 20);
  return out;
}

/** Fields stored on the Onboarding document (the full answers go in `data`). */
export function submissionFields(a: OnboardingAnswers) {
  return {
    name: a.contactPerson,
    email: a.email.toLowerCase(),
    phone: a.phone,
    company: a.businessName,
    website: a.currentWebsite,
    services: [`${a.package} Website`, ...a.addOns],
    budget: `${a.package} (${packagePrice(a.package)})`,
    message: a.businessDescription || a.notes,
    data: { ...a, source: "portal" },
    source: "portal",
  };
}

// ---------- Approve ----------

function projectDescription(a: Partial<OnboardingAnswers>) {
  return [
    `Package: ${a.package || "—"}${a.package ? ` (${packagePrice(a.package)})` : ""}`,
    a.pagesNeeded?.length ? `Pages: ${a.pagesNeeded.join(", ")}` : "",
    a.addOns?.length ? `Add-ons: ${a.addOns.join(", ")}` : "",
    a.mainGoal ? `Main goal: ${a.mainGoal}` : "",
    a.targetAudience ? `Target audience: ${a.targetAudience}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Approves a submission for a client (an existing one, or "new" to create the client from the form).
 * Only now does the project get created: stage Approved, website checklist plus one task per add-on,
 * and the uploaded logo / files attached as documents.
 */
export async function approveSubmission(
  sub: any,
  clientChoice: string,
  actor: CurrentUser,
  /** Details for a new client (edited in the approve panel); defaults come from the form. */
  newClient: { name?: string; company?: string; email?: string; phone?: string } = {}
) {
  if (sub.status === "Approved" || sub.status === "Converted" || sub.project) throw new HttpError("This submission is already approved");
  const a: Partial<OnboardingAnswers> = sub.data || {};

  let clientId: string;
  if (clientChoice === "new") {
    const pick = (v: unknown, fallback?: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : fallback);
    const name = pick(newClient.name, sub.name);
    if (!name) throw new HttpError("Client name is required");
    const client = await Client.create({
      name,
      company: pick(newClient.company, sub.company),
      email: pick(newClient.email, sub.email)?.toLowerCase(),
      phone: pick(newClient.phone, sub.phone),
      website: sub.website,
      source: "Onboarding Form",
      status: "Active",
    });
    clientId = String(client._id);
  } else {
    if (!validId(clientChoice) || !(await Client.exists({ _id: clientChoice }))) throw new HttpError("Choose the client this form belongs to");
    clientId = clientChoice;
  }

  const isPortalForm = sub.source === "portal";
  const title = isPortalForm ? `${sub.company || sub.name}: ${a.package || "Website"} Website` : sub.services?.length ? sub.services.join(", ") : `${sub.company || sub.name}: New project`;
  const checklist = [...DEFAULT_CHECKLIST.website!, ...(a.addOns || []).map((x) => `Add-on: ${x}`)];
  const documents = [
    ...(a.logoUrl ? [{ name: "Logo (from onboarding form)", url: a.logoUrl, visibleToClient: true, addedBy: sub.name }] : []),
    ...(a.attachmentUrls || []).map((url, i) => ({ name: `Onboarding file ${i + 1}`, url, visibleToClient: true, addedBy: sub.name })),
  ];

  const project = await Project.create({
    client: clientId,
    title: title.slice(0, 200),
    service: "Website Development",
    description: isPortalForm ? projectDescription(a) : sub.message,
    stage: "Approved",
    progress: STAGE_INFO.Approved.progress,
    startDate: new Date(),
    domain: sub.website || undefined,
    onboarding: sub._id,
    checklist: checklist.map((label) => ({ label })),
    documents,
  });

  sub.client = clientId;
  sub.project = project._id;
  sub.status = "Approved";
  sub.approvedAt = new Date();
  sub.approvedBy = actor.name;
  await sub.save();

  await logActivity(project, actor, `Onboarding form approved by ${actor.name}`, false);
  await logActivity(project, actor, "Onboarding approved: your project has started", true);
  await notify(await clientUserIds(clientId), {
    title: `Onboarding approved: ${project.title}`,
    body: "Thanks for the details. Your project has started; follow every step in your portal.",
    link: `/portal/projects/${project._id}`,
    email: { button: "Open portal" },
  });
  await referralConverted(sub, clientId, String(project._id));
  return { clientId, projectId: String(project._id) };
}
