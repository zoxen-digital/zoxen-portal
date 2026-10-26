import { dbConnect } from "@/lib/db";
import { error, handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { getConfig, stats } from "@/lib/outreach/engine";
import { CATEGORY_TAGS } from "@/lib/outreach/discover";
import { OutreachConfig, OutreachLog, OutreachMailbox, OutreachProspect } from "@/models/Outreach";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Everything the outreach dashboard needs in one call. */
export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  const [config, s, mailboxes, logs, unreadReplies] = await Promise.all([
    getConfig(),
    stats(),
    OutreachMailbox.find().sort({ createdAt: 1 }).lean(),
    OutreachLog.find().sort({ at: -1 }).limit(60).lean(),
    OutreachProspect.countDocuments({ repliedAt: { $ne: null }, reviewed: false }),
  ]);
  const { lockUntil: _l, ...cfg } = config;
  return json({ config: cfg, stats: s, mailboxes, logs, categories: Object.keys(CATEGORY_TAGS), unreadReplies });
});

const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
};

/** Save campaign settings. */
export const PUT = handle(async (req: Request) => {
  await apiUser(ADMIN);
  const b = await req.json().catch(() => ({}));
  await dbConnect();
  const cur = await getConfig();
  const set: Record<string, unknown> = {};
  if (Array.isArray(b.targets)) {
    const prev = new Map((cur.targets || []).map((t: any) => [`${t.category}|${t.city}`.toLowerCase(), t]));
    const targets = b.targets
      .filter((t: any) => t && CATEGORY_TAGS[String(t.category).toLowerCase()] && String(t.city || "").trim())
      .slice(0, 100)
      .map((t: any) => {
        const category = String(t.category).toLowerCase();
        const city = String(t.city).trim().slice(0, 80);
        const old: any = prev.get(`${category}|${city}`.toLowerCase());
        return { category, city, done: old?.done || false, found: old?.found || 0 };
      });
    set.targets = targets;
  }
  if (b.dailyLimit !== undefined) set.dailyLimit = num(b.dailyLimit, 1, 2000, 500);
  if (Array.isArray(b.followUpDays)) set.followUpDays = b.followUpDays.map((d: unknown) => num(d, 1, 30, 3)).slice(0, 3).sort((x: number, y: number) => x - y);
  if (b.sendFromHour !== undefined) set.sendFromHour = num(b.sendFromHour, 0, 23, 9);
  if (b.sendToHour !== undefined) set.sendToHour = num(b.sendToHour, 1, 24, 17);
  if (typeof b.requireApproval === "boolean") set.requireApproval = b.requireApproval;
  if (typeof b.senderName === "string") set.senderName = b.senderName.trim().slice(0, 80);
  if (typeof b.postalAddress === "string") set.postalAddress = b.postalAddress.trim().slice(0, 200);
  if (typeof b.offer === "string") set.offer = b.offer.trim().slice(0, 400);
  if (b.maxBounceRate !== undefined) set.maxBounceRate = num(b.maxBounceRate, 1, 15, 5);
  if (set.sendFromHour !== undefined && set.sendToHour !== undefined && (set.sendToHour as number) <= (set.sendFromHour as number)) return error("Sending window must end after it starts");
  await OutreachConfig.updateOne({ key: "main" }, { $set: set });
  return json({ ok: true });
});
