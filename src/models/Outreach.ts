// Must load before the schemas below are compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Cold email outreach: one settings document, sending mailboxes, discovered prospects,
 * a do-not-contact list and an activity log. The engine (lib/outreach/engine) works through
 * these in small batches on every tick, so it can stop and resume at any point without repeats.
 */

export const PROSPECT_STAGES = [
  "new", // found, not checked yet
  "audited", // website checked / email looked up
  "ready", // email written, waiting for a sending slot
  "sending", // claimed by a tick (guards against double sends)
  "sent", // first email out, waiting for reply or follow-up
  "replied",
  "bounced",
  "unsubscribed",
  "no_email", // no public business email found
  "skipped", // not a fit (chain, duplicate, existing client...)
  "completed", // all follow-ups sent, no reply
  "error",
] as const;

export const REPLY_CATEGORIES = ["Interested", "Not Interested", "Follow-Up Required", "Out of Office", "Unsubscribe", "Other"] as const;

const TargetSchema = new Schema({ category: String, city: String, done: { type: Boolean, default: false }, found: { type: Number, default: 0 } }, { _id: false });

const OutreachConfigSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    status: { type: String, enum: ["stopped", "running", "paused"], default: "stopped" },
    pausedReason: { type: String, default: "" },
    targets: { type: [TargetSchema], default: [] },
    /** Hard ceiling across all mailboxes; the warm-up ramp keeps the real number lower at first. */
    dailyLimit: { type: Number, default: 500 },
    followUpDays: { type: [Number], default: [3, 7] },
    /** Recipient business hours (US Central). Emails are only sent inside this window, on weekdays. */
    sendFromHour: { type: Number, default: 9 },
    sendToHour: { type: Number, default: 17 },
    requireApproval: { type: Boolean, default: false },
    senderName: { type: String, default: "" },
    /** Required by US CAN-SPAM: a real postal address in every email. */
    postalAddress: { type: String, default: "" },
    offer: { type: String, default: "We build fast, mobile-friendly websites with online menus, ordering and booking, usually live within 7 days." },
    maxBounceRate: { type: Number, default: 5 },
    lockUntil: { type: Date, default: null },
    lastTickAt: { type: Date, default: null },
    lastTickSummary: { type: String, default: "" },
    stats: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const MailboxSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    fromName: { type: String, default: "" },
    smtpHost: String,
    smtpPort: { type: Number, default: 465 },
    imapHost: String,
    imapPort: { type: Number, default: 993 },
    username: String,
    /** AES-GCM encrypted with AUTH_SECRET; never sent to the browser. */
    passwordEnc: { type: String, select: false },
    active: { type: Boolean, default: true },
    /** Per-mailbox ceiling after warm-up. 30-50 is the safe range for cold email. */
    dailyCap: { type: Number, default: 40 },
    warmupStart: { type: Number, default: 10 },
    warmupStep: { type: Number, default: 5 },
    startedAt: { type: Date, default: Date.now },
    sentDay: { type: String, default: "" },
    sentToday: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
    imapLastUid: { type: Number, default: 0 },
    imapUidValidity: { type: String, default: "" },
    lastError: { type: String, default: "" },
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const AuditSchema = new Schema(
  {
    checkedAt: Date,
    reachable: Boolean,
    https: Boolean,
    mobile: Boolean,
    loadMs: Number,
    title: String,
    platform: String,
    copyrightYear: Number,
    hasOrdering: Boolean,
    hasBooking: Boolean,
    menuPdf: Boolean,
    placeholder: Boolean,
    findings: [String],
    score: Number,
  },
  { _id: false }
);

const MessageSchema = new Schema(
  {
    dir: { type: String, enum: ["out", "in"] },
    kind: { type: String, default: "" }, // first | followup1 | followup2 | reply | manual
    subject: String,
    body: String,
    at: { type: Date, default: Date.now },
    messageId: String,
    from: String,
  },
  { _id: false }
);

const ProspectSchema = new Schema(
  {
    /** e.g. "osm:node/123": the same business is never added twice. */
    sourceKey: { type: String, required: true, unique: true },
    source: { type: String, default: "osm" },
    name: { type: String, required: true },
    category: String,
    city: String,
    address: String,
    phone: String,
    website: String,
    email: { type: String, lowercase: true, trim: true },
    emailSource: String,
    stage: { type: String, enum: PROSPECT_STAGES, default: "new", index: true },
    audit: { type: AuditSchema, default: null },
    draft: { subject: String, body: String, by: String },
    approved: { type: Boolean, default: false },
    mailbox: { type: Schema.Types.ObjectId, ref: "OutreachMailbox", default: null },
    messages: { type: [MessageSchema], default: [] },
    followUpsSent: { type: Number, default: 0 },
    nextSendAt: { type: Date, default: null, index: true },
    firstSentAt: { type: Date, default: null },
    repliedAt: { type: Date, default: null },
    replyCategory: { type: String, enum: [...REPLY_CATEGORIES, ""], default: "" },
    reviewed: { type: Boolean, default: false },
    query: { type: Schema.Types.ObjectId, ref: "Query", default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);
ProspectSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
ProspectSchema.index({ stage: 1, nextSendAt: 1 });
ProspectSchema.index({ "messages.messageId": 1 });

const SuppressionSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    reason: { type: String, enum: ["unsubscribed", "bounced", "complaint", "manual", "replied-no"], default: "manual" },
    note: String,
  },
  { timestamps: true }
);

const OutreachLogSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    level: { type: String, enum: ["info", "warn", "error"], default: "info" },
    msg: String,
    prospect: { type: Schema.Types.ObjectId, ref: "OutreachProspect", default: null },
  },
  { versionKey: false }
);
OutreachLogSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });

export const OutreachConfig: Model<any> = models.OutreachConfig || model("OutreachConfig", OutreachConfigSchema);
export const OutreachMailbox: Model<any> = models.OutreachMailbox || model("OutreachMailbox", MailboxSchema);
export const OutreachProspect: Model<any> = models.OutreachProspect || model("OutreachProspect", ProspectSchema);
export const Suppression: Model<any> = models.Suppression || model("Suppression", SuppressionSchema);
export const OutreachLog: Model<any> = models.OutreachLog || model("OutreachLog", OutreachLogSchema);
