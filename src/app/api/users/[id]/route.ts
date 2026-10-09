import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { Project } from "@/models/Project";
import { error, handle, json, pick, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { MANAGED_ROLES } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

async function otherActiveSuperAdmins(id: string) {
  return User.countDocuments({ _id: { $ne: id }, role: "super_admin", status: "active" });
}

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const me = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  // The hidden owner (agent) account is invisible here: it does not exist for super admins.
  const user = await User.findOne({ _id: id, role: { $ne: "agent" } });
  if (!user) return error("User not found", 404);

  const data = pick(await req.json(), ["name", "role", "client", "title", "phone", "status"]);
  if ("name" in data && !data.name) return error("Name is required");
  if ("role" in data && !MANAGED_ROLES.includes(data.role as never)) return error("Invalid role");
  if ("status" in data && !["active", "disabled", "invited"].includes(String(data.status))) return error("Invalid status");

  const losingAdmin =
    user.role === "super_admin" && ((data.role && data.role !== "super_admin") || data.status === "disabled");
  if (losingAdmin) {
    if (id === me.id) return error("You cannot remove your own super admin access");
    if (!(await otherActiveSuperAdmins(id))) return error("Keep at least one active super admin");
  }
  // Re-enabling someone who never set a password puts them back to "invited".
  if (data.status === "active" && user.status === "disabled") {
    const withPw = await User.findById(id).select("+passwordHash").lean<{ passwordHash?: string }>();
    if (!withPw?.passwordHash) data.status = "invited";
  }

  const role = (data.role as string) || user.role;
  if (role === "client") {
    const client = "client" in data ? data.client : user.client;
    if (!client || !validId(String(client))) return error("Choose which client this login belongs to");
  } else {
    data.client = undefined;
  }

  user.set(data);
  await user.save();
  return json(user);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const me = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  if (id === me.id) return error("You cannot delete your own account");
  await dbConnect();
  const user = await User.findOne({ _id: id, role: { $ne: "agent" } });
  if (!user) return json({ ok: true });
  if (user.role === "super_admin" && !(await otherActiveSuperAdmins(id))) return error("Keep at least one active super admin");
  await Project.updateMany({ team: id }, { $pull: { team: id } });
  await user.deleteOne();
  return json({ ok: true });
});
