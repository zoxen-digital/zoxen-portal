import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { Project } from "@/models/Project";
import { error, handle, json, validId } from "@/lib/api";
import { AGENT, apiUser } from "@/lib/session";
import { hashPassword, passwordProblem } from "@/lib/password";

type Ctx = { params: Promise<{ id: string }> };
const STAFF_ROLES = ["super_admin", "team_admin"];

async function staffUser(id: string) {
  if (!validId(id)) return null;
  await dbConnect();
  return User.findOne({ _id: id, role: { $in: STAFF_ROLES } }).select("+passwordHash");
}

/** Body (any of): { name, title, role, status: "active" | "disabled", password }. Banning or a new password signs them out. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(AGENT);
  const { id } = await params;
  const user = await staffUser(id);
  if (!user) return error("User not found", 404);
  const b = await req.json().catch(() => ({}));
  let signOut = false;

  if ("name" in b) {
    const n = String(b.name || "").trim();
    if (!n) return error("Name is required");
    user.name = n.slice(0, 80);
  }
  if ("title" in b) user.title = String(b.title || "").trim().slice(0, 80);
  if ("role" in b) {
    if (!STAFF_ROLES.includes(b.role)) return error("Choose Super Admin or Team Admin");
    if (b.role !== user.role) signOut = true;
    user.role = b.role;
  }
  if ("status" in b) {
    if (!["active", "disabled"].includes(b.status)) return error("Invalid status");
    if (b.status === "disabled") signOut = true;
    // Re-enabling someone who never set a password puts them back to "invited".
    user.status = b.status === "active" && !user.passwordHash ? "invited" : b.status;
  }
  if (b.password) {
    const problem = passwordProblem(b.password);
    if (problem) return error(problem);
    user.passwordHash = await hashPassword(b.password);
    if (user.status === "invited") user.status = "active";
    signOut = true;
  }
  if (signOut) user.sessionVersion = (user.sessionVersion || 0) + 1;
  await user.save();
  return json({ _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(AGENT);
  const { id } = await params;
  const user = await staffUser(id);
  if (!user) return error("User not found", 404);
  await Project.updateMany({ team: id }, { $pull: { team: id } });
  await user.deleteOne();
  return json({ ok: true, name: user.name });
});
