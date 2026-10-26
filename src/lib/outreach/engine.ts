import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/mailer";
import { notify, superAdminIds } from "@/lib/notify";
import { Client } from "@/models/Client";
import { OutreachConfig, OutreachLog, OutreachMailbox, OutreachProspect, Suppression } from "@/models/Outreach";
import { discover } from "./discover";
import { auditSite, deliverable } from "./audit";
import { classifyReply, followUpEmail, writeFirstEmail } from "./writer";
import { fetchNew, sendOne, type Box, type Incoming } from "./mail";
import { unsubToken } from "./secure";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The outreach engine. Every tick (an external cron every ~5 minutes, or the open dashboard) does a
 * small, time-boxed slice of work, so nothing depends on the browser staying open and an interrupted
 * tick simply continues next time:
 *   1. read replies and bounces   2. safety checks   3. find businesses   4. audit websites / find emails
 *   5. write emails   6. send first emails   7. send follow-ups
 * A database lock stops two ticks overlapping; each email is claimed before sending, so it is never sent twice.
 */

const TZ = "America/Chicago";
const DAY = 86_400_000;

export async function log(msg: string, level: "info" | "warn" | "error" = "info", prospect?: unknown) {
  await OutreachLog.create({ msg: msg.slice(0, 500), level, prospect: prospect || null }).catch(() => {});
}

export async function getConfig() {
  await dbConnect();
  return OutreachConfig.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, new: true }).lean<any>();
}

function central(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { hour: Number(parts.hour) % 24, weekday: parts.weekday as string, day: `${parts.year}-${parts.month}-${parts.day}` };
}

/** How many emails a mailbox may send today: warm-up ramp, capped at its daily cap. */
export function allowance(b: any, today: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(b.startedAt || Date.now()).getTime()) / DAY));
  const ramp = Math.min(b.dailyCap || 40, (b.warmupStart || 10) + (b.warmupStep || 5) * days);
  const used = b.sentDay === today ? b.sentToday || 0 : 0;
  return { ramp, used, left: Math.max(0, ramp - used) };
}

function footer(cfg: any, company: string, email: string) {
  const url = appUrl(`/api/public/unsubscribe?t=${unsubToken(email)}`);
  return {
    url,
    text: `\n\n--\n${company}${cfg.postalAddress ? `, ${cfg.postalAddress}` : ""}\nNot interested? Reply "unsubscribe" or click ${url} and we will not email you again.`,
  };
}

// ---------------- 1. Replies and bounces ----------------

/** Handles one incoming email for a mailbox: a bounce, a reply to our outreach, or unrelated (ignored). */
export async function handleIncoming(b: { email: string }, m: Incoming) {
  let bounced = 0;
  if (m.isBounce) {
    for (const addr of m.bouncedTo) {
      const p = await OutreachProspect.findOneAndUpdate({ email: addr, stage: { $in: ["sent", "sending", "completed"] } }, { $set: { stage: "bounced", nextSendAt: null } });
      if (p) {
        bounced++;
        await Suppression.updateOne({ email: addr }, { $setOnInsert: { email: addr, reason: "bounced" } }, { upsert: true });
        await log(`Bounced: ${addr} (${p.name})`, "warn", p._id);
      }
    }
    return { replied: 0, bounced };
  }
  const ids = [m.inReplyTo, ...m.references].filter(Boolean);
  const p =
    (ids.length && (await OutreachProspect.findOne({ "messages.messageId": { $in: ids } }))) ||
    (m.from && (await OutreachProspect.findOne({ email: m.from, stage: { $in: ["sent", "completed", "replied"] } })));
  if (!p || m.from === b.email) return { replied: 0, bounced };
  const category = await classifyReply(m.text);
  const unsub = category === "Unsubscribe";
  await OutreachProspect.updateOne(
    { _id: p._id },
    {
      $push: { messages: { dir: "in", kind: "reply", subject: m.subject, body: m.text.slice(0, 8000), at: m.date, from: m.from } },
      $set: { stage: unsub ? "unsubscribed" : "replied", repliedAt: m.date, replyCategory: category, reviewed: false, nextSendAt: null },
    }
  );
  if (unsub || category === "Not Interested") {
    await Suppression.updateOne({ email: p.email }, { $setOnInsert: { email: p.email, reason: unsub ? "unsubscribed" : "replied-no" } }, { upsert: true });
  }
  await log(`Reply from ${p.name}: ${category}`, "info", p._id);
  if (category === "Interested" || category === "Follow-Up Required") {
    await notify(await superAdminIds(), {
      title: `${category === "Interested" ? "Interested reply" : "Reply needs follow-up"}: ${p.name}`,
      body: m.text.replace(/\s+/g, " ").slice(0, 140),
      link: `/outreach?tab=replies&p=${p._id}`,
      email: { button: "Open reply" },
    });
  }
  return { replied: 1, bounced };
}

async function readInboxes(deadline: number) {
  const boxes = await OutreachMailbox.find({ active: true }).select("+passwordEnc").lean<any[]>();
  let replies = 0;
  let bounces = 0;
  for (const b of boxes) {
    if (Date.now() > deadline - 8000 || !b.passwordEnc || !b.imapHost) continue;
    try {
      const { messages, maxUid, uidValidity } = await fetchNew(b as Box, b.imapLastUid || 0, b.imapUidValidity || "", Math.min(20000, deadline - Date.now() - 5000));
      for (const m of messages) {
        const r = await handleIncoming(b, m);
        replies += r.replied;
        bounces += r.bounced;
      }
      await OutreachMailbox.updateOne({ _id: b._id }, { $set: { imapLastUid: maxUid, imapUidValidity: uidValidity, lastCheckedAt: new Date(), lastError: "" } });
    } catch (e) {
      await OutreachMailbox.updateOne({ _id: b._id }, { $set: { lastError: `Inbox: ${(e as Error).message}`.slice(0, 300), lastCheckedAt: new Date() } });
      await log(`Could not read ${b.email}: ${(e as Error).message}`, "warn");
    }
  }
  return { replies, bounces };
}

// ---------------- 2. Safety ----------------

async function safetyCheck(cfg: any) {
  const since = new Date(Date.now() - 7 * DAY);
  const [sent, bounced] = await Promise.all([
    OutreachProspect.countDocuments({ firstSentAt: { $gte: since } }),
    OutreachProspect.countDocuments({ firstSentAt: { $gte: since }, stage: "bounced" }),
  ]);
  const rate = sent ? (bounced / sent) * 100 : 0;
  if (sent >= 20 && rate > (cfg.maxBounceRate || 5)) {
    const reason = `Paused automatically: bounce rate ${rate.toFixed(1)}% in the last 7 days (limit ${cfg.maxBounceRate || 5}%). Check your lead emails and mailbox before resuming.`;
    await OutreachConfig.updateOne({ key: "main" }, { $set: { status: "paused", pausedReason: reason } });
    await log(reason, "error");
    await notify(await superAdminIds(), { title: "Outreach paused: too many bounces", body: reason, link: "/outreach", email: { button: "Open outreach" } });
    return false;
  }
  return true;
}

// ---------------- 3. Discovery ----------------

async function discoverMore(cfg: any) {
  const pipeline = await OutreachProspect.countDocuments({ stage: { $in: ["new", "audited", "ready"] } });
  if (pipeline >= 60) return 0;
  const idx = (cfg.targets || []).findIndex((t: any) => !t.done);
  if (idx < 0) return 0;
  const t = cfg.targets[idx];
  let added = 0;
  try {
    const found = await discover(t.category, t.city, 200);
    const clientEmails = new Set((await Client.find({ email: { $ne: null } }).select("email").lean<any[]>()).map((c) => String(c.email).toLowerCase()));
    for (const { email, ...f } of found) {
      if (email && clientEmails.has(email)) continue;
      // A map email is kept aside ("map:...") and only used after it passes validation.
      const r = await OutreachProspect.updateOne({ sourceKey: f.sourceKey }, { $setOnInsert: { ...f, emailSource: email ? `map:${email}` : "", stage: "new" } }, { upsert: true });
      if (r.upsertedCount) added++;
    }
    await OutreachConfig.updateOne({ key: "main" }, { $set: { [`targets.${idx}.done`]: true, [`targets.${idx}.found`]: added } });
    await log(`Found ${added} new ${t.category} businesses in ${t.city} (${found.length} listed on the map)`);
  } catch (e) {
    await log(`Search failed for ${t.category} in ${t.city}: ${(e as Error).message}`, "warn");
  }
  return added;
}

// ---------------- 4. Audit + email lookup ----------------

/** Checks websites 4 at a time (the tick lock guarantees no other run touches the same prospects). */
async function enrich(deadline: number) {
  let n = 0;
  while (Date.now() < deadline - 15000 && n < 24) {
    const batch = await OutreachProspect.find({ stage: "new" }).sort({ createdAt: 1 }).limit(4).lean<any[]>();
    if (!batch.length) break;
    await OutreachProspect.updateMany({ _id: { $in: batch.map((p) => p._id) } }, { $inc: { attempts: 1 } });
    await Promise.all(batch.map((p) => enrichOne({ ...p, attempts: (p.attempts || 0) + 1 })));
    n += batch.length;
  }
  return n;
}

async function enrichOne(p: any) {
  {
    try {
      let email = "";
      let source = "";
      let audit = null;
      if (p.website) {
        const r = await auditSite(p.website);
        audit = r.audit;
        for (const e of r.emails) {
          if (await deliverable(e)) {
            email = e;
            source = "website";
            break;
          }
        }
      }
      const mapEmail = String(p.emailSource || "").startsWith("map:") ? p.emailSource.slice(4) : "";
      if (!email && mapEmail && (await deliverable(mapEmail))) {
        email = mapEmail;
        source = "map";
      }
      if (!email) {
        await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: "no_email", audit, emailSource: "" } });
        return;
      }
      if (await Suppression.exists({ email })) {
        await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: "skipped", audit, lastError: "On the do-not-contact list" } });
        return;
      }
      if (await OutreachProspect.exists({ email, _id: { $ne: p._id } })) {
        await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: "skipped", audit, lastError: "Same email as another business (chain or shared inbox)" } });
        return;
      }
      // A website with nothing to fix is not a good lead for a web agency.
      if (audit && audit.reachable && audit.findings.length === 0) {
        await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: "skipped", audit, email, emailSource: source, lastError: "Website already in good shape" } });
        return;
      }
      await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: "audited", audit, email, emailSource: source } });
    } catch (e) {
      await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: p.attempts >= 3 ? "error" : "new", lastError: (e as Error).message.slice(0, 200) } });
    }
  }
}

// ---------------- 5. Write ----------------

async function writeDrafts(deadline: number, cfg: any, company: string) {
  let n = 0;
  while (Date.now() < deadline - 10000 && n < 8) {
    const p = await OutreachProspect.findOneAndUpdate({ stage: "audited" }, { $set: { stage: "audited" } }, { sort: { createdAt: 1 } }).lean<any>();
    if (!p) break;
    const d = await writeFirstEmail(p, { senderName: cfg.senderName, offer: cfg.offer, companyName: company });
    await OutreachProspect.updateOne({ _id: p._id, stage: "audited" }, { $set: { stage: "ready", draft: d } });
    n++;
  }
  return n;
}

// ---------------- 6 + 7. Send ----------------

async function pickBox(boxes: any[], today: string) {
  const usable = boxes.map((b) => ({ b, ...allowance(b, today) })).filter((x) => x.left > 0);
  usable.sort((a, b) => a.used - b.used);
  return usable[0]?.b || null;
}

async function markSent(b: any, today: string) {
  await OutreachMailbox.updateOne({ _id: b._id, sentDay: { $ne: today } }, { $set: { sentDay: today, sentToday: 0 } });
  await OutreachMailbox.updateOne({ _id: b._id }, { $inc: { sentToday: 1 }, $set: { lastSentAt: new Date() } });
  if (b.sentDay !== today) {
    b.sentDay = today;
    b.sentToday = 0;
  }
  b.sentToday++;
}

const isRecipientError = (e: any) => /^5\d\d/.test(String(e?.responseCode || "")) && /recipient|mailbox|user unknown|does not exist|no such user|invalid address|rejected/i.test(String(e?.response || e?.message || ""));
const isAuthError = (e: any) => /auth|login|credentials|535|534|username and password/i.test(String(e?.response || e?.message || ""));

async function sendBatch(deadline: number, cfg: any, company: string) {
  const { hour, weekday, day } = central();
  if (["Sat", "Sun"].includes(weekday) || hour < (cfg.sendFromHour ?? 9) || hour >= (cfg.sendToHour ?? 17)) return { sent: 0, note: "outside sending hours" };
  const boxes = await OutreachMailbox.find({ active: true }).select("+passwordEnc").lean<any[]>();
  if (!boxes.length) return { sent: 0, note: "no mailbox connected" };

  const totalToday = boxes.reduce((s, b) => s + allowance(b, day).used, 0);
  const capLeft = Math.max(0, (cfg.dailyLimit || 500) - totalToday);
  const boxLeft = boxes.reduce((s, b) => s + allowance(b, day).left, 0);
  const remaining = Math.min(capLeft, boxLeft);
  if (!remaining) return { sent: 0, note: "daily limit reached" };
  // Spread the day's emails across the sending window (ticks every ~5 min) instead of sending in bursts.
  const ticksLeft = Math.max(1, ((cfg.sendToHour ?? 17) - hour) * 12);
  const thisTick = Math.min(15, Math.max(1, Math.ceil(remaining / ticksLeft)));
  let sent = 0;

  while (sent < thisTick && Date.now() < deadline - 8000) {
    // Follow-ups due first (they belong to people already contacted), then new first emails.
    const now = new Date();
    let p = await OutreachProspect.findOneAndUpdate(
      { stage: "sent", nextSendAt: { $lte: now }, followUpsSent: { $lt: (cfg.followUpDays || [3, 7]).length } },
      { $set: { stage: "sending" } },
      { sort: { nextSendAt: 1 }, new: true }
    ).lean<any>();
    const isFollowUp = !!p;
    if (!p) {
      p = await OutreachProspect.findOneAndUpdate({ stage: "ready", ...(cfg.requireApproval ? { approved: true } : {}) }, { $set: { stage: "sending" } }, { sort: { createdAt: 1 }, new: true }).lean<any>();
    }
    if (!p) break;
    const back = isFollowUp ? "sent" : "ready";

    if (await Suppression.exists({ email: p.email })) {
      await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: "skipped", lastError: "On the do-not-contact list" } });
      continue;
    }
    const b = isFollowUp ? boxes.find((x) => String(x._id) === String(p.mailbox)) : await pickBox(boxes, day);
    if (!b || allowance(b, day).left <= 0) {
      await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: back } });
      if (!isFollowUp) break;
      // Its mailbox is full today: try again later.
      await OutreachProspect.updateOne({ _id: p._id }, { $set: { nextSendAt: new Date(Date.now() + 3 * 3600_000) } });
      continue;
    }
    const n = (p.followUpsSent || 0) + 1;
    const first = (p.messages || []).find((m: any) => m.dir === "out");
    const subject = isFollowUp ? `Re: ${first?.subject || p.draft?.subject}` : p.draft.subject;
    const body = isFollowUp ? followUpEmail(n, p, { senderName: cfg.senderName, offer: cfg.offer, companyName: company }) : p.draft.body;
    const foot = footer(cfg, company, p.email);
    try {
      const messageId = await sendOne(b as Box, {
        to: p.email,
        subject,
        text: body + foot.text,
        unsubscribeUrl: foot.url,
        ...(isFollowUp && first?.messageId ? { inReplyTo: first.messageId, references: (p.messages || []).filter((m: any) => m.messageId).map((m: any) => m.messageId) } : {}),
      });
      await markSent(b, day);
      const days = cfg.followUpDays || [3, 7];
      const firstAt = isFollowUp ? new Date(p.firstSentAt) : new Date();
      const nextIdx = isFollowUp ? n : 0;
      const next = nextIdx < days.length ? new Date(firstAt.getTime() + days[nextIdx] * DAY) : null;
      await OutreachProspect.updateOne(
        { _id: p._id },
        {
          $push: { messages: { dir: "out", kind: isFollowUp ? `followup${n}` : "first", subject, body, messageId, from: b.email } },
          $set: {
            stage: next ? "sent" : "completed",
            mailbox: b._id,
            nextSendAt: next,
            ...(isFollowUp ? { followUpsSent: n } : { firstSentAt: new Date() }),
            lastError: "",
          },
        }
      );
      sent++;
      // Small human-like gap between emails.
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500));
    } catch (e: any) {
      if (isRecipientError(e)) {
        await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: "bounced", lastError: String(e.response || e.message).slice(0, 200) } });
        await Suppression.updateOne({ email: p.email }, { $setOnInsert: { email: p.email, reason: "bounced" } }, { upsert: true });
        await log(`Rejected by server: ${p.email}`, "warn", p._id);
      } else if (isAuthError(e)) {
        await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: back } });
        await OutreachMailbox.updateOne({ _id: b._id }, { $set: { active: false, lastError: `Login failed, mailbox paused: ${String(e.message).slice(0, 150)}` } });
        await log(`Mailbox ${b.email} login failed; it was paused. Update its password in Settings.`, "error");
        boxes.splice(boxes.indexOf(b), 1);
        if (!boxes.length) break;
      } else {
        const attempts = (p.attempts || 0) + 1;
        await OutreachProspect.updateOne({ _id: p._id }, { $set: { stage: attempts >= 4 ? "error" : back, lastError: String(e.message).slice(0, 200), attempts } });
        await log(`Send failed for ${p.email}: ${e.message}`, "warn", p._id);
        break;
      }
    }
  }
  return { sent, note: "" };
}

// ---------------- Tick ----------------

export async function tick(opts: { budgetMs?: number } = {}) {
  await dbConnect();
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? 50_000);
  await getConfig();
  const lock = await OutreachConfig.findOneAndUpdate(
    { key: "main", $or: [{ lockUntil: null }, { lockUntil: { $lt: new Date() } }] },
    { $set: { lockUntil: new Date(started + (opts.budgetMs ?? 50_000) + 30_000) } },
    { new: true }
  ).lean<any>();
  if (!lock) return { skipped: "another run is in progress" };
  const out: Record<string, unknown> = {};
  try {
    const company = (await getSettings()).companyName || "Zoxen Digital";
    Object.assign(out, await readInboxes(Math.min(deadline, started + 25_000)));
    const cfg = await OutreachConfig.findOne({ key: "main" }).lean<any>();
    if (cfg.status === "running") {
      if (!cfg.postalAddress?.trim()) {
        out.note = "Add your postal address in Outreach settings (required by law) before sending.";
      } else if (await safetyCheck(cfg)) {
        out.discovered = await discoverMore(cfg);
        out.audited = await enrich(deadline - 20_000);
        out.written = await writeDrafts(deadline - 12_000, cfg, company);
        const s = await sendBatch(deadline, cfg, company);
        out.sent = s.sent;
        if (s.note) out.note = s.note;
      }
    } else out.note = `campaign ${cfg.status}`;
  } catch (e) {
    out.error = (e as Error).message;
    await log(`Run error: ${(e as Error).message}`, "error");
  } finally {
    const summary = Object.entries(out)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    await OutreachConfig.updateOne({ key: "main" }, { $set: { lockUntil: null, lastTickAt: new Date(), lastTickSummary: summary.slice(0, 300) } });
  }
  return out;
}

// ---------------- Dashboard numbers ----------------

export async function stats() {
  await dbConnect();
  const { day } = central();
  const [byStage, byReply, boxes, sentTotal, bounced, suppressed] = await Promise.all([
    OutreachProspect.aggregate([{ $group: { _id: "$stage", n: { $sum: 1 } } }]),
    OutreachProspect.aggregate([{ $match: { replyCategory: { $ne: "" } } }, { $group: { _id: "$replyCategory", n: { $sum: 1 } } }]),
    OutreachMailbox.find().lean<any[]>(),
    OutreachProspect.countDocuments({ firstSentAt: { $ne: null } }),
    OutreachProspect.countDocuments({ stage: "bounced" }),
    Suppression.countDocuments(),
  ]);
  const s = Object.fromEntries(byStage.map((x: any) => [x._id, x.n])) as Record<string, number>;
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  const audited = total - (s.new || 0);
  const written = (s.ready || 0) + (s.sending || 0) + sentTotal;
  const sentToday = boxes.reduce((a, b) => a + allowance(b, day).used, 0);
  const capToday = boxes.filter((b) => b.active).reduce((a, b) => a + allowance(b, day).ramp, 0);
  const replies = Object.fromEntries(byReply.map((x: any) => [x._id, x.n])) as Record<string, number>;
  return {
    discovered: total,
    audited,
    noEmail: s.no_email || 0,
    skipped: s.skipped || 0,
    written,
    waiting: s.ready || 0,
    sent: sentTotal,
    sentToday,
    capToday,
    delivered: Math.max(0, sentTotal - bounced),
    bounced,
    replied: Object.values(replies).reduce((a, b) => a + b, 0),
    interested: replies.Interested || 0,
    converted: await OutreachProspect.countDocuments({ query: { $ne: null } }),
    replies,
    stages: s,
    suppressed,
  };
}

/** Bulk lead finding without the per-run time limit (run from a computer, not Vercel): searches every open target, then checks every website. */
export async function harvest(say: (m: string) => void = console.log) {
  await dbConnect();
  const cfg = await getConfig();
  const clientEmails = new Set((await Client.find({ email: { $ne: null } }).select("email").lean<any[]>()).map((c) => String(c.email).toLowerCase()));
  for (const [idx, t] of (cfg.targets || []).entries() as IterableIterator<[number, any]>) {
    if (t.done) continue;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const found = await discover(t.category, t.city, 200, 300_000);
        let added = 0;
        for (const { email, ...f } of found) {
          if (email && clientEmails.has(email)) continue;
          const r = await OutreachProspect.updateOne({ sourceKey: f.sourceKey }, { $setOnInsert: { ...f, emailSource: email ? `map:${email}` : "", stage: "new" } }, { upsert: true });
          if (r.upsertedCount) added++;
        }
        await OutreachConfig.updateOne({ key: "main" }, { $set: { [`targets.${idx}.done`]: true, [`targets.${idx}.found`]: added } });
        await log(`Found ${added} new ${t.category} businesses in ${t.city} (${found.length} listed on the map)`);
        say(`${t.category} in ${t.city}: ${added} new`);
        break;
      } catch (e) {
        say(`${t.category} in ${t.city}: try ${attempt} failed (${(e as Error).message})`);
        if (/state or country|Unknown category|Could not find/.test((e as Error).message)) break;
        await new Promise((r) => setTimeout(r, 20000));
      }
    }
  }
  let n = 0;
  for (;;) {
    const batch = await OutreachProspect.find({ stage: "new", attempts: { $lt: 3 } }).sort({ createdAt: 1 }).limit(8).lean<any[]>();
    if (!batch.length) break;
    await OutreachProspect.updateMany({ _id: { $in: batch.map((p) => p._id) } }, { $inc: { attempts: 1 } });
    await Promise.all(batch.map((p) => enrichOne({ ...p, attempts: (p.attempts || 0) + 1 })));
    n += batch.length;
    if (n % 40 === 0) say(`checked ${n} websites, ${await OutreachProspect.countDocuments({ stage: "audited" })} with an email so far`);
  }
  say(`done: checked ${n}, ${await OutreachProspect.countDocuments({ stage: "audited" })} ready for an email`);
}
