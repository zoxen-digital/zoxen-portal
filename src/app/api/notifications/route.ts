import { dbConnect } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { handle, json, validId } from "@/lib/api";
import { apiUser } from "@/lib/session";

const ALL = ["agent", "super_admin", "team_admin", "client"] as const;

export const GET = handle(async () => {
  const user = await apiUser([...ALL]);
  await dbConnect();
  const [items, unread] = await Promise.all([
    Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: user.id, read: false }),
  ]);
  return json({ items, unread });
});

/** Body { id } marks one as read; { all: true } marks everything read. */
export const PUT = handle(async (req: Request) => {
  const user = await apiUser([...ALL]);
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  if (body.all) await Notification.updateMany({ user: user.id, read: false }, { read: true });
  else if (typeof body.id === "string" && validId(body.id)) await Notification.updateOne({ _id: body.id, user: user.id }, { read: true });
  return json({ ok: true });
});
