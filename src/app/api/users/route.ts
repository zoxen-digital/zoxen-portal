import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { Client } from "@/models/Client";
import { error, handle, json, pick, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { issueInvite } from "@/lib/invite";
import { MANAGED_ROLES } from "@/lib/auth";
import { USER_FIELDS } from "@/lib/fields";

export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  const users = await User.find({ role: { $ne: "agent" } }).sort({ role: 1, name: 1 }).populate("client", "name company").lean();
  return json(users);
});

export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const body = await req.json();
  const data = pick(body, USER_FIELDS);
  data.email = String(data.email || "").toLowerCase();
  if (!data.name) return error("Name is required");
  if (!/^\S+@\S+\.\S+$/.test(String(data.email))) return error("Enter a valid email");
  if (!MANAGED_ROLES.includes(data.role as never)) return error("Choose a role");
  if (data.role === "client") {
    if (!data.client || !validId(String(data.client))) return error("Choose which client this login belongs to");
    if (!(await Client.exists({ _id: data.client }))) return error("Client not found");
  } else {
    delete data.client;
  }
  if (await User.exists({ email: data.email })) return error("A user with this email already exists");

  const user = await User.create({ ...data, status: "invited" });
  const invite = body.sendInvite === false ? null : await issueInvite(String(user._id));
  return json({ user, invite }, 201);
});
