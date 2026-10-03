import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runDailyJobs } from "@/lib/reminders";

export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Runs once a day (Vercel Cron, see vercel.json): recurring invoices, reminders, expiries, morning digests. */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runDailyJobs();
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), result });
}
