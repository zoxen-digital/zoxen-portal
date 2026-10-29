import { dbConnect } from "@/lib/db";
import { error, handle, json } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { escapeRegex } from "@/lib/utils";
import { CATEGORY_TAGS, discover } from "@/lib/outreach/discover";
import { FINDER_STATUSES, FinderLead } from "@/models/FinderLead";

export const maxDuration = 60;
const PAGE = 100;

/** Found businesses, newest search first (filters: status, search text). */
export const GET = handle(async (req: Request) => {
  await apiUser(STAFF);
  const u = new URL(req.url);
  const status = u.searchParams.get("status") || "";
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const filter: Record<string, unknown> = {};
  if ((FINDER_STATUSES as readonly string[]).includes(status)) filter.status = status;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    filter.$or = [{ name: rx }, { phone: rx }, { website: rx }, { city: rx }, { category: rx }];
  }
  await dbConnect();
  const [items, total, counts] = await Promise.all([
    FinderLead.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * PAGE).limit(PAGE).lean(),
    FinderLead.countDocuments(filter),
    FinderLead.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  return json({ items, total, page, pageSize: PAGE, counts: Object.fromEntries(counts.map((c: { _id: string; n: number }) => [c._id, c.n])), categories: Object.keys(CATEGORY_TAGS) });
});

/** Search the map for a category in a city and keep the ones with a phone number. */
export const POST = handle(async (req: Request) => {
  await apiUser(STAFF);
  const b = await req.json().catch(() => ({}));
  const category = String(b.category || "").toLowerCase();
  const city = String(b.city || "").trim().slice(0, 80);
  if (!CATEGORY_TAGS[category]) return error("Choose a business type");
  if (!city) return error("Write a city, e.g. Houston, TX");
  let found;
  try {
    found = await discover(category, city, 300, 45_000);
  } catch (e) {
    return error((e as Error).message);
  }
  const withPhone = found.filter((f) => f.phone.replace(/\D/g, "").length >= 7);
  await dbConnect();
  let added = 0;
  for (const f of withPhone) {
    const r = await FinderLead.updateOne(
      { sourceKey: f.sourceKey },
      { $setOnInsert: { sourceKey: f.sourceKey, name: f.name, phone: f.phone, website: f.website, address: f.address, category, city } },
      { upsert: true }
    );
    if (r.upsertedCount) added++;
  }
  return json({ found: found.length, withPhone: withPhone.length, added });
});
