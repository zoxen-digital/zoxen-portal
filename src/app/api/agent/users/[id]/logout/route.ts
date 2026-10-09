import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { error, handle, json, validId } from "@/lib/api";
import { AGENT, apiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Signs a staff member out of every device right now (their current cookies stop working). */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(AGENT);
  const { id } = await params;
  if (!validId(id)) return error("User not found", 404);
  await dbConnect();
  const user = await User.findOneAndUpdate({ _id: id, role: { $in: ["super_admin", "team_admin"] } }, { $inc: { sessionVersion: 1 } }, { new: true });
  if (!user) return error("User not found", 404);
  return json({ ok: true, name: user.name });
});
