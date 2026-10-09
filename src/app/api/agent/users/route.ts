import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { error, handle, json } from "@/lib/api";
import { AGENT, apiUser } from "@/lib/session";
import { hashPassword, passwordProblem } from "@/lib/password";

// The owner manages staff accounts only: super admins and team admins (never clients, never other owners).
const STAFF_ROLES = ["super_admin", "team_admin"];

export const GET = handle(async () => {
  await apiUser(AGENT);
  await dbConnect();
  return json(await User.find({ role: { $in: STAFF_ROLES } }).sort({ role: 1, name: 1 }).lean());
});

/** Body: { name, email, password, role, title? }. The owner sets the password directly; the account is active at once. */
export const POST = handle(async (req: Request) => {
  await apiUser(AGENT);
  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!name) return error("Name is required");
  if (!/^\S+@\S+\.\S+$/.test(email)) return error("Enter a valid email");
  if (!STAFF_ROLES.includes(b.role)) return error("Choose Super Admin or Team Admin");
  const problem = passwordProblem(b.password);
  if (problem) return error(problem);
  await dbConnect();
  if (await User.exists({ email })) return error("An account with this email already exists");
  const user = await User.create({
    name,
    email,
    role: b.role,
    title: typeof b.title === "string" ? b.title.trim().slice(0, 80) : "",
    status: "active",
    passwordHash: await hashPassword(b.password),
  });
  return json({ _id: user._id, name: user.name, email: user.email, role: user.role }, 201);
});
