import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { error, handle, json } from "@/lib/api";
import { apiUser } from "@/lib/session";

const ALL = ["agent", "super_admin", "team_admin", "client"] as const;

/** Saves this browser/phone so it can receive push notifications. */
export const POST = handle(async (req: Request) => {
  const user = await apiUser([...ALL]);
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return error("Invalid subscription");
  await dbConnect();
  await User.updateOne({ _id: user.id }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } });
  // Keep the 10 most recent devices.
  await User.updateOne(
    { _id: user.id },
    { $push: { pushSubscriptions: { $each: [{ endpoint: sub.endpoint, keys: sub.keys }], $slice: -10 } } }
  );
  return json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const user = await apiUser([...ALL]);
  const { endpoint } = await req.json().catch(() => ({}));
  await dbConnect();
  if (typeof endpoint === "string") await User.updateOne({ _id: user.id }, { $pull: { pushSubscriptions: { endpoint } } });
  return json({ ok: true });
});
