import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "zx_session";

export const ROLES = ["super_admin", "team_admin", "client"] as const;
export type Role = (typeof ROLES)[number];

export type Session = { uid: string; role: Role; name: string; email: string; cid?: string };

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-secret-change-me-in-env-file");
}

export async function createSession(s: Session) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    // Sessions from before roles existed carry no uid/role: treat them as signed out.
    if (typeof payload.uid !== "string" || !ROLES.includes(payload.role as Role)) return null;
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Where each role lands after signing in. */
export function homeFor(role: Role) {
  return role === "client" ? "/portal" : role === "team_admin" ? "/today" : "/dashboard";
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};
