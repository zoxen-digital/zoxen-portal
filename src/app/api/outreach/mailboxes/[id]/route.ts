import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { encrypt } from "@/lib/outreach/secure";
import { OutreachMailbox } from "@/models/Outreach";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Mailbox not found", 404);
  const b = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  if (typeof b.active === "boolean") set.active = b.active;
  if (typeof b.fromName === "string") set.fromName = b.fromName.trim().slice(0, 60);
  if (b.dailyCap !== undefined) set.dailyCap = Math.min(100, Math.max(5, Number(b.dailyCap) || 40));
  if (b.warmupStart !== undefined) set.warmupStart = Math.min(50, Math.max(3, Number(b.warmupStart) || 10));
  if (b.warmupStep !== undefined) set.warmupStep = Math.min(20, Math.max(1, Number(b.warmupStep) || 5));
  if (typeof b.password === "string" && b.password) {
    set.passwordEnc = encrypt(b.password);
    set.lastError = "";
  }
  if (set.active === true) set.lastError = "";
  await dbConnect();
  const box = await OutreachMailbox.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  return box ? json(box) : error("Mailbox not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Mailbox not found", 404);
  await dbConnect();
  await OutreachMailbox.deleteOne({ _id: id });
  return json({ ok: true });
});
