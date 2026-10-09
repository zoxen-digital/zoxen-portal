import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, homeFor, verifySession, type Role } from "./auth";
import { HttpError } from "./api";
import { dbConnect } from "./db";
import { User } from "@/models/User";

export type CurrentUser = { id: string; role: Role; name: string; email: string; clientId?: string };

/**
 * The signed-in user, re-read from the database so disabled accounts and role
 * changes take effect immediately (the cookie alone stays valid for 7 days).
 * Cached per request.
 */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  await dbConnect();
  const u = await User.findById(session.uid).select("name email role client status sessionVersion").lean<{
    _id: unknown;
    name: string;
    email: string;
    role: Role;
    client?: unknown;
    status: string;
    sessionVersion?: number;
  }>();
  // A role change also signs the user out, because the middleware routes by the role in the cookie.
  if (!u || u.status !== "active" || u.role !== session.role) return null;
  // Forced logout: the cookie was issued before the last session reset.
  if ((session.sv ?? 0) !== (u.sessionVersion ?? 0)) return null;
  return { id: String(u._id), role: u.role, name: u.name, email: u.email, clientId: u.client ? String(u.client) : undefined };
});

/** For server pages: signs out or bounces to the user's own home if the role is not allowed. */
export async function pageUser(roles: Role[]) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** For API routes: throws 401/403, which handle() turns into a JSON error. */
export async function apiUser(roles: Role[]) {
  const user = await currentUser();
  if (!user) throw new HttpError("Please sign in again", 401);
  if (!roles.includes(user.role)) throw new HttpError("You do not have access to this", 403);
  return user;
}

export const STAFF: Role[] = ["super_admin", "team_admin"];
export const ADMIN: Role[] = ["super_admin"];
export const AGENT: Role[] = ["agent"];
export const EVERYONE: Role[] = ["agent", "super_admin", "team_admin", "client"];
