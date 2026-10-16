import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { mapColumns, rowToLead } from "@/lib/lead-sheet";
import { LeadList } from "@/models/LeadList";
import { Lead } from "@/models/Lead";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BATCH = 1000;

/** Adds a batch of sheet rows: { headers: string[], rows: unknown[][] }. Skips people already on the sheet. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Sheet not found", 404);
  const b = await req.json().catch(() => ({}));
  if (!Array.isArray(b.headers) || !Array.isArray(b.rows)) return error("Nothing to import");
  if (b.rows.length > MAX_BATCH) return error(`Send at most ${MAX_BATCH} rows at a time`);
  await dbConnect();
  if (!(await LeadList.exists({ _id: id }))) return error("Sheet not found", 404);

  const headers: string[] = b.headers.slice(0, 60).map((h: unknown) => String(h ?? ""));
  const map = mapColumns(headers);
  const leads = (b.rows as unknown[])
    .filter(Array.isArray)
    .map((r) => rowToLead(headers, map, r as unknown[]))
    .filter((x): x is NonNullable<typeof x> => !!x);

  // Same person twice (same LinkedIn URL or email): keep the first.
  const existing = await Lead.find({ list: id }).select("linkedin email").lean<{ linkedin?: string; email?: string }[]>();
  const seen = new Set(existing.flatMap((l) => [l.linkedin, l.email].filter(Boolean) as string[]));
  const fresh = leads.filter((l) => {
    const keys = [l.linkedin, l.email].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
  if (fresh.length) await Lead.insertMany(fresh.map((l) => ({ ...l, list: id })));
  return json({ added: fresh.length, skipped: leads.length - fresh.length, empty: b.rows.length - leads.length });
});
