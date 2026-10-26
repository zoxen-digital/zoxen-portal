import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { tick } from "@/lib/outreach/engine";

export const maxDuration = 60;

/**
 * Background worker for outreach. Call every 5 minutes from an external scheduler (e.g. cron-job.org),
 * because Vercel's free plan only runs its own cron once a day. Auth: header "Authorization: Bearer CRON_SECRET"
 * or ?key=CRON_SECRET for schedulers that cannot set headers.
 */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") || `Bearer ${new URL(req.url).searchParams.get("key") || ""}`);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tick({ budgetMs: 50_000 });
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), result });
}
