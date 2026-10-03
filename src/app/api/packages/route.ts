import { dbConnect } from "@/lib/db";
import { Package } from "@/models/Package";
import { handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { packageData } from "@/lib/packages";

export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  return json(await Package.find().sort({ active: -1, name: 1 }).lean());
});

export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const pkg = await Package.create(packageData(await req.json().catch(() => ({}))));
  return json(pkg, 201);
});
