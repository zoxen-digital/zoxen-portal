import { dbConnect } from "@/lib/db";
import { Package } from "@/models/Package";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { packageData } from "@/lib/packages";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  // Quick toggle from the list: { active }
  const data =
    Object.keys(body).length === 1 && "active" in body ? { active: body.active === true || body.active === "Active" } : packageData(body);
  const pkg = await Package.findByIdAndUpdate(id, data, { new: true }).lean();
  return pkg ? json(pkg) : error("Package not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Package.findByIdAndDelete(id);
  return json({ ok: true });
});
