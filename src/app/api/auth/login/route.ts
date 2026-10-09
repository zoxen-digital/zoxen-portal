import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, createSession, homeFor, type Role } from "@/lib/auth";
import { checkPassword, hashPassword } from "@/lib/password";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";
import { envAgent, recordLogin } from "@/lib/logins";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * The .env admin login creates the first super admin account the first time it is used,
 * and keeps working afterwards as a recovery login for that account.
 */
async function envAdmin(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return null;
  if (!safeEqual(email, adminEmail) || !safeEqual(password, adminPassword)) return null;

  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    if (existing.role !== "super_admin" || existing.status === "disabled") return null;
    if (existing.status !== "active") {
      existing.status = "active";
      await existing.save();
    }
    return existing;
  }
  return User.create({
    name: process.env.ADMIN_NAME || "Admin",
    email: adminEmail,
    role: "super_admin",
    status: "active",
    passwordHash: await hashPassword(adminPassword),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });

  try {
    await dbConnect();
    let user = await User.findOne({ email }).select("+passwordHash");
    const passwordOk = user?.status === "active" && (await checkPassword(password, user.passwordHash));
    if (!passwordOk) user = (await envAdmin(email, password)) || (await envAgent(email, password));

    if (!user) {
      await recordLogin(req, { email, success: false });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await recordLogin(req, { user, email, success: true });

    user.lastLoginAt = new Date();
    await user.save();

    const role = user.role as Role;
    const token = await createSession({
      uid: String(user._id),
      role,
      name: user.name,
      email: user.email,
      cid: user.client ? String(user.client) : undefined,
      sv: user.sessionVersion || 0,
    });
    const res = NextResponse.json({ ok: true, home: homeFor(role) });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Login failed" }, { status: 500 });
  }
}
