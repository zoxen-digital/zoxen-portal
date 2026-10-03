import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, createSession, homeFor, type Role } from "@/lib/auth";
import { hashPassword, hashToken, passwordProblem } from "@/lib/password";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";

/** Uses a one-time invite/reset link: sets the password and signs the user in. */
export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    await dbConnect();
    const user = await User.findOne({ inviteTokenHash: hashToken(token) }).select("+inviteExpires");
    if (!user || !user.inviteExpires || user.inviteExpires.getTime() < Date.now()) {
      return NextResponse.json({ error: "This link has expired or was already used. Ask us for a new one." }, { status: 400 });
    }
    if (user.status === "disabled") return NextResponse.json({ error: "This account is disabled" }, { status: 403 });

    user.passwordHash = await hashPassword(password);
    user.inviteTokenHash = undefined;
    user.inviteExpires = undefined;
    user.status = "active";
    user.lastLoginAt = new Date();
    await user.save();

    const role = user.role as Role;
    const session = await createSession({
      uid: String(user._id),
      role,
      name: user.name,
      email: user.email,
      cid: user.client ? String(user.client) : undefined,
    });
    const res = NextResponse.json({ ok: true, home: homeFor(role) });
    res.cookies.set(SESSION_COOKIE, session, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not set your password. Please try again." }, { status: 500 });
  }
}
