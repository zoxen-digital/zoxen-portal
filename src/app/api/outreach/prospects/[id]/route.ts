import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/mailer";
import { sendOne, type Box } from "@/lib/outreach/mail";
import { getConfig, log } from "@/lib/outreach/engine";
import { unsubToken } from "@/lib/outreach/secure";
import { OutreachMailbox, OutreachProspect, REPLY_CATEGORIES, Suppression } from "@/models/Outreach";
import { Query } from "@/models/Query";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Not found", 404);
  await dbConnect();
  const p = await OutreachProspect.findById(id).populate("mailbox", "email").lean();
  if (!p) return error("Not found", 404);
  await OutreachProspect.updateOne({ _id: id }, { $set: { reviewed: true } });
  return json(p);
});

/** Edit the draft, approve it, change the reply category, skip or stop contacting. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Not found", 404);
  const b = await req.json().catch(() => ({}));
  await dbConnect();
  const p = await OutreachProspect.findById(id);
  if (!p) return error("Not found", 404);
  if (typeof b.approved === "boolean") p.approved = b.approved;
  if (b.draft && ["ready", "audited"].includes(p.stage)) {
    p.draft = { subject: String(b.draft.subject || "").slice(0, 120), body: String(b.draft.body || "").slice(0, 3000), by: "edited" };
  }
  if ((REPLY_CATEGORIES as readonly string[]).includes(b.replyCategory)) p.replyCategory = b.replyCategory;
  if (b.action === "skip" && !["sent", "replied", "completed", "bounced"].includes(p.stage)) p.stage = "skipped";
  if (b.action === "do-not-contact" && p.email) {
    await Suppression.updateOne({ email: p.email }, { $setOnInsert: { email: p.email, reason: "manual" } }, { upsert: true });
    if (["ready", "sent", "audited"].includes(p.stage)) p.stage = "skipped";
    p.nextSendAt = null;
  }
  await p.save();
  return json(p.toObject());
});

/** Actions: send a reply in the thread, or turn the prospect into a Query. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Not found", 404);
  const b = await req.json().catch(() => ({}));
  await dbConnect();
  const p = await OutreachProspect.findById(id).lean<any>();
  if (!p) return error("Not found", 404);

  if (b.action === "to-query") {
    if (p.query && (await Query.exists({ _id: p.query }))) return json({ queryId: String(p.query), existed: true });
    const last = [...(p.messages || [])].reverse().find((m: any) => m.dir === "in");
    const q = await Query.create({
      client: null,
      lead: { name: p.name, email: p.email, phone: p.phone, company: p.name, source: "Cold email", page: p.website },
      title: `Cold email lead: ${p.name}`,
      service: "Website Development",
      description: [last ? `Their reply: ${String(last.body).slice(0, 1500)}` : "", (p.audit?.findings || []).length ? `Website findings:\n- ${p.audit.findings.join("\n- ")}` : ""].filter(Boolean).join("\n\n"),
      status: "Pending",
      priority: p.replyCategory === "Interested" ? "High" : "Medium",
    });
    await OutreachProspect.updateOne({ _id: id }, { $set: { query: q._id } });
    await log(`${p.name} moved to Queries by ${user.name}`, "info", p._id);
    return json({ queryId: String(q._id) }, 201);
  }

  if (b.action === "reply") {
    const text = String(b.body || "").trim();
    if (!text) return error("Write a reply");
    if (await Suppression.findOne({ email: p.email, reason: { $in: ["unsubscribed", "bounced", "complaint"] } })) return error("This contact unsubscribed or bounced; do not email them");
    const box = await OutreachMailbox.findOne({ _id: p.mailbox, active: true }).select("+passwordEnc").lean<Box>();
    if (!box) return error("The mailbox used for this conversation is not connected or is paused");
    const cfg = await getConfig();
    const company = (await getSettings()).companyName || "Zoxen Digital";
    const firstOut = (p.messages || []).find((m: any) => m.dir === "out");
    const lastIn = [...(p.messages || [])].reverse().find((m: any) => m.dir === "in");
    const subject = /^re:/i.test(lastIn?.subject || "") ? lastIn.subject : `Re: ${lastIn?.subject || firstOut?.subject || p.name}`;
    const url = appUrl(`/api/public/unsubscribe?t=${unsubToken(p.email)}`);
    const refs = (p.messages || []).filter((m: any) => m.messageId).map((m: any) => m.messageId);
    const messageId = await sendOne(box, {
      to: p.email,
      subject,
      text: `${text}\n\n--\n${company}${cfg.postalAddress ? `, ${cfg.postalAddress}` : ""}`,
      unsubscribeUrl: url,
      ...(refs.length ? { inReplyTo: refs[refs.length - 1], references: refs } : {}),
    });
    await OutreachProspect.updateOne(
      { _id: id },
      { $push: { messages: { dir: "out", kind: "manual", subject, body: text, messageId, from: box.email } }, $set: { reviewed: true, nextSendAt: null } }
    );
    return json({ ok: true });
  }
  return error("Unknown action");
});
