import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { notify } from "@/lib/notify";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type Ctx = { params: Promise<{ id: string }> };

/** Only the person doing the task, the person who gave it, or the owner can change it. */
async function load(id: string, user: { id: string; role: string }) {
  if (!validId(id)) return null;
  await dbConnect();
  const t = await Task.findById(id);
  if (!t) return null;
  const mine = String(t.assignee) === user.id || String(t.createdBy) === user.id || user.role === "super_admin";
  return mine ? t : null;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const t = await load((await params).id, user);
  if (!t) return error("Task not found", 404);
  const b = await req.json().catch(() => ({}));
  if (typeof b.done === "boolean") {
    t.done = b.done;
    t.doneAt = b.done ? new Date() : null;
    if (b.done && String(t.createdBy) !== user.id) await notify([t.createdBy], { title: `${user.name} finished: ${t.title}`, link: "/today", email: { button: "Open My Day" } });
  }
  if (typeof b.title === "string" && b.title.trim()) t.title = b.title.trim().slice(0, 200);
  if (typeof b.description === "string") t.description = b.description.slice(0, 5000);
  if (b.dueAt !== undefined) {
    const d = b.dueAt ? new Date(b.dueAt) : null;
    if (d && isNaN(d.getTime())) return error("Choose a valid due date");
    t.dueAt = d;
  }
  if (b.assignee && validId(String(b.assignee)) && String(b.assignee) !== String(t.assignee)) {
    if (!(await User.exists({ _id: b.assignee, role: { $in: STAFF }, status: { $ne: "disabled" } }))) return error("Choose a team member");
    t.assignee = b.assignee;
    if (String(b.assignee) !== user.id) await notify([b.assignee], { title: `New task from ${user.name}: ${t.title}`, body: t.description ? t.description.slice(0, 500) : undefined, link: "/today", email: { button: "Open My Day" } });
  }
  await t.save();
  return json(t.toObject());
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const t = await load((await params).id, user);
  if (!t) return error("Task not found", 404);
  await t.deleteOne();
  return json({ ok: true });
});
