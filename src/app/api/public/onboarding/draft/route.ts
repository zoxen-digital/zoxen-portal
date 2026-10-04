import { dbConnect } from "@/lib/db";
import { Client } from "@/models/Client";
import { error, handle, json } from "@/lib/api";

/**
 * Draft of a half-filled onboarding form, saved per client (personal link only), so the
 * client can close the page and continue later, even on another device.
 */
const MAX_BYTES = 60_000;

async function clientFor(token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{10,40}$/.test(token)) return null;
  await dbConnect();
  return Client.findOne({ onboardingToken: token }).select("onboardingDraft");
}

export const GET = handle(async (req: Request) => {
  const c = await clientFor(new URL(req.url).searchParams.get("token"));
  if (!c) return error("Not found", 404);
  return json({ draft: c.onboardingDraft?.data ? { data: c.onboardingDraft.data, savedAt: c.onboardingDraft.savedAt } : null });
});

export const PUT = handle(async (req: Request) => {
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return error("Draft too large", 413);
  let body: { token?: unknown; data?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return error("Invalid draft");
  }
  if (!body.data || typeof body.data !== "object") return error("Invalid draft");
  const c = await clientFor(body.token);
  if (!c) return error("Not found", 404);
  const savedAt = new Date();
  c.onboardingDraft = { data: body.data, savedAt };
  await c.save();
  return json({ ok: true, savedAt });
});

export const DELETE = handle(async (req: Request) => {
  const c = await clientFor(new URL(req.url).searchParams.get("token"));
  if (c) {
    c.onboardingDraft = undefined;
    await c.save();
  }
  return json({ ok: true });
});
