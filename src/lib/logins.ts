import { timingSafeEqual } from "crypto";
import { hashPassword } from "./password";
import { notify } from "./notify";
import { LoginEvent } from "@/models/LoginEvent";
import { User } from "@/models/User";

/* eslint-disable @typescript-eslint/no-explicit-any */

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * The owner ("agent") account comes from AGENT_EMAIL / AGENT_PASSWORD in the environment:
 * created on its first sign-in. After that the stored password is used (it can be changed in My account),
 * and the env password keeps working as a recovery login.
 */
export async function envAgent(email: string, password: string) {
  const agentEmail = process.env.AGENT_EMAIL?.trim().toLowerCase();
  const agentPassword = process.env.AGENT_PASSWORD;
  if (!agentEmail || !agentPassword) return null;
  if (!safeEqual(email, agentEmail) || !safeEqual(password, agentPassword)) return null;
  const existing = await User.findOne({ email: agentEmail });
  if (existing) {
    if (existing.role !== "agent") return null;
    if (existing.status !== "active") {
      existing.status = "active";
      await existing.save();
    }
    return existing;
  }
  return User.create({ name: "Agent", email: agentEmail, role: "agent", status: "active", passwordHash: await hashPassword(agentPassword) });
}

/** Rough device name from the browser string, e.g. "Chrome on Windows". */
export function deviceName(ua: string) {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

export function requestMeta(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  return {
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() || "unknown",
    country: req.headers.get("x-vercel-ip-country") || "",
    city: decodeURIComponent(req.headers.get("x-vercel-ip-city") || ""),
    userAgent: ua.slice(0, 300),
    device: deviceName(ua),
  };
}

/**
 * Records a sign-in. A successful one from a device + network not seen for this user in 90 days
 * counts as "new" and the owner gets an alert (staff accounts only; clients are many and change devices often).
 */
export async function recordLogin(req: Request, opts: { user?: any; email: string; success: boolean }) {
  try {
    const meta = requestMeta(req);
    let newDevice = false;
    if (opts.success && opts.user) {
      const seen = await LoginEvent.exists({
        user: opts.user._id,
        success: true,
        device: meta.device,
        ip: meta.ip,
        at: { $gte: new Date(Date.now() - 90 * 86_400_000) },
      });
      const any = await LoginEvent.exists({ user: opts.user._id, success: true });
      newDevice = !seen && !!any;
    }
    await LoginEvent.create({
      user: opts.user?._id,
      email: opts.email,
      name: opts.user?.name,
      role: opts.user?.role,
      success: opts.success,
      newDevice,
      ...meta,
    });
    if (newDevice && opts.user.role !== "client") {
      const agents = await User.find({ role: "agent", status: "active" }).select("_id").lean();
      await notify(
        agents.map((a) => String(a._id)),
        {
          title: `New device sign-in: ${opts.user.name}`,
          body: `${meta.device} · ${[meta.city, meta.country].filter(Boolean).join(", ") || "unknown location"} · IP ${meta.ip}`,
          link: "/agent/logins",
          email: { button: "View login history" },
        }
      );
    }
  } catch (e) {
    console.error("Login record failed:", e);
  }
}
