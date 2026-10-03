import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { error, handle, json } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { checkPassword, hashPassword, passwordProblem } from "@/lib/password";

const ALL = ["super_admin", "team_admin", "client"] as const;

/** Change own name / phone, and optionally password (needs the current one). */
export const PUT = handle(async (req: Request) => {
  const me = await apiUser([...ALL]);
  const body = await req.json().catch(() => ({}));
  await dbConnect();
  const user = await User.findById(me.id).select("+passwordHash");
  if (!user) return error("User not found", 404);

  if (typeof body.name === "string") {
    if (!body.name.trim()) return error("Name is required");
    user.name = body.name.trim();
  }
  if (typeof body.phone === "string") user.phone = body.phone.trim();

  if (body.newPassword) {
    if (!(await checkPassword(String(body.currentPassword || ""), user.passwordHash))) return error("Current password is wrong");
    const problem = passwordProblem(body.newPassword);
    if (problem) return error(problem);
    user.passwordHash = await hashPassword(body.newPassword);
  }
  await user.save();
  return json({ ok: true });
});
