import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { issueInvite } from "@/lib/invite";

type Ctx = { params: Promise<{ id: string }> };

/** New invite link (or password reset link for active users). */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const user = await User.findOne({ _id: id, role: { $ne: "agent" } }).lean<{ status: string }>();
  if (!user) return error("User not found", 404);
  if (user.status === "disabled") return error("Enable this user first");
  return json(await issueInvite(id));
});
