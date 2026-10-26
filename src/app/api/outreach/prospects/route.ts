import { dbConnect } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { escapeRegex } from "@/lib/utils";
import { OutreachProspect, PROSPECT_STAGES, REPLY_CATEGORIES } from "@/models/Outreach";

const PAGE = 50;

/** Prospect list for the dashboard tables (filters: stage, reply category, search). */
export const GET = handle(async (req: Request) => {
  await apiUser(ADMIN);
  const u = new URL(req.url);
  const stage = u.searchParams.get("stage") || "";
  const reply = u.searchParams.get("reply") || "";
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const filter: Record<string, unknown> = {};
  if ((PROSPECT_STAGES as readonly string[]).includes(stage)) filter.stage = stage;
  if (stage === "replies") filter.repliedAt = { $ne: null };
  if (stage === "no-response") Object.assign(filter, { stage: { $in: ["sent", "completed"] }, repliedAt: null });
  if ((REPLY_CATEGORIES as readonly string[]).includes(reply)) filter.replyCategory = reply;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    filter.$or = [{ name: rx }, { email: rx }, { city: rx }, { website: rx }];
  }
  await dbConnect();
  const sort: Record<string, 1 | -1> = stage === "replies" ? { repliedAt: -1 } : { updatedAt: -1 };
  const [items, total] = await Promise.all([
    OutreachProspect.find(filter)
      .select("name category city email website phone stage replyCategory repliedAt reviewed firstSentAt followUpsSent audit.score audit.findings draft.subject draft.by approved lastError updatedAt query")
      .sort(sort)
      .skip((page - 1) * PAGE)
      .limit(PAGE)
      .lean(),
    OutreachProspect.countDocuments(filter),
  ]);
  return json({ items, total, page, pageSize: PAGE });
});
