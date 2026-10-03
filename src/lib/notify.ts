import webpush from "web-push";
import { dbConnect } from "./db";
import { appUrl, sendMail } from "./mailer";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";

let vapidReady: boolean | null = null;
function pushEnabled() {
  if (vapidReady === null) {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    vapidReady = !!(pub && priv);
    if (vapidReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${process.env.SMTP_USER || "admin@example.com"}`, pub!, priv!);
  }
  return vapidReady;
}

type Message = {
  title: string;
  body?: string;
  /** App path, e.g. /portal/projects/123 */
  link?: string;
  /** Also send a branded email. Use for things the person must act on. */
  email?: { subject?: string; button?: string };
};

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * In-app bell + phone/browser push for every recipient, plus email when asked.
 * Never throws: a failed notification must not undo the action that triggered it.
 */
export async function notify(userIds: (string | { toString(): string })[], m: Message) {
  const ids = [...new Set(userIds.map(String))];
  if (!ids.length) return;
  try {
    await dbConnect();
    const users = await User.find({ _id: { $in: ids }, status: { $ne: "disabled" } })
      .select("+pushSubscriptions email name status")
      .lean<{ _id: unknown; email: string; name: string; status: string; pushSubscriptions?: PushSub[] }[]>();
    if (!users.length) return;

    await Notification.insertMany(users.map((u) => ({ user: u._id, title: m.title, body: m.body, link: m.link })));

    const jobs: Promise<unknown>[] = [];
    if (pushEnabled()) {
      const payload = JSON.stringify({ title: m.title, body: m.body || "", url: m.link || "/" });
      for (const u of users) {
        for (const sub of u.pushSubscriptions || []) {
          jobs.push(
            webpush.sendNotification(sub, payload).catch(async (err: { statusCode?: number }) => {
              // 404/410 = the browser unsubscribed; forget that device.
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                await User.updateOne({ _id: u._id }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } });
              }
            })
          );
        }
      }
    }
    if (m.email) {
      for (const u of users) {
        // Invited users have not set a password yet; their invite email is enough.
        if (u.status !== "active") continue;
        jobs.push(
          sendMail({
            to: u.email,
            subject: m.email.subject || m.title,
            heading: m.title,
            lines: [`Hi ${u.name.split(" ")[0]},`, ...(m.body ? [m.body] : [])],
            button: m.link ? { label: m.email.button || "Open", url: appUrl(m.link) } : undefined,
          })
        );
      }
    }
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error("Notification failed:", e);
  }
}

/** Every active super admin, for alerts that the owner should always see. */
export async function superAdminIds() {
  await dbConnect();
  const admins = await User.find({ role: "super_admin", status: "active" }).select("_id").lean();
  return admins.map((a) => String(a._id));
}

/** Every active portal login of a client company. */
export async function clientUserIds(clientId: string) {
  await dbConnect();
  const users = await User.find({ role: "client", client: clientId, status: "active" }).select("_id").lean();
  return users.map((u) => String(u._id));
}
