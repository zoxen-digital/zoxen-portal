import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { notify } from "@/lib/notify";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

/** Tasks assigned to me or that I gave to someone. */
export const GET = handle(async () => {
  const user = await apiUser(STAFF);
  await dbConnect();
  const tasks = await Task.find({ $or: [{ assignee: user.id }, { createdBy: user.id }] })
    .sort({ done: 1, dueAt: 1, createdAt: -1 })
    .limit(300)
    .populate("assignee", "name")
    .populate("createdBy", "name")
    .lean();
  return json(tasks);
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser(STAFF);
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim().slice(0, 200);
  if (!title) return error("Write what the task is");
  const assignee = b.assignee && validId(String(b.assignee)) ? String(b.assignee) : user.id;
  await dbConnect();
  if (!(await User.exists({ _id: assignee, role: { $in: STAFF }, status: { $ne: "disabled" } }))) return error("Choose a team member");
  const dueAt = b.dueAt ? new Date(b.dueAt) : null;
  if (dueAt && isNaN(dueAt.getTime())) return error("Choose a valid due date");
  const task = await Task.create({ title, description: String(b.description || "").slice(0, 5000), dueAt, assignee, createdBy: user.id });
  if (assignee !== user.id) {
    await notify([assignee], { title: `New task from ${user.name}: ${title}`, body: dueAt ? "Check the due date on My Day." : "See it on My Day.", link: "/today" });
  }
  return json(task, 201);
});
