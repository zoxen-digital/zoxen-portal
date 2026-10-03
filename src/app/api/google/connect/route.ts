import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ADMIN, apiUser } from "@/lib/session";
import { googleAuthUrl, googleConfigured } from "@/lib/google";
import { handle } from "@/lib/api";


/** Starts "Connect Google Calendar": redirects the super admin to Google's consent screen. */
export const GET = handle(async (req: Request) => {
  await apiUser(ADMIN);
  const origin = new URL(req.url).origin;
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/settings?google=not-configured`);
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleAuthUrl(`${origin}/api/google/callback`, state));
  res.cookies.set("zx_g_state", state, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), path: "/", maxAge: 600 });
  return res;
});
