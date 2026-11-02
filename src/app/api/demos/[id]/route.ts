import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { DEMO_INDUSTRIES, DemoSite } from "@/models/DemoSite";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Not found", 404);
  const b = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) set.name = b.name.trim().slice(0, 80);
  if ((DEMO_INDUSTRIES as readonly string[]).includes(b.industry)) set.industry = b.industry;
  if (typeof b.visible === "boolean") set.visible = b.visible;
  await dbConnect();
  const d = await DemoSite.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  return d ? json(d) : error("Not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Not found", 404);
  await dbConnect();
  await DemoSite.deleteOne({ _id: id });
  return json({ ok: true });
});
