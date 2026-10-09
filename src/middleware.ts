import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, homeFor, verifySession, type Role } from "@/lib/auth";

const PUBLIC_PREFIXES = [
  "/login",
  "/invite/",
  "/invoice/",
  "/quote/",
  "/onboarding",
  "/api/upload",
  "/contract/",
  "/api/cron/",
  "/api/auth/login",
  "/api/auth/invite",
  "/api/public/",
  "/api/onboarding/submit",
  "/sw.js",
  "/icons/",
  "/manifest.webmanifest",
];

// Paths every signed-in user may open, whatever the role.
const SHARED = ["/api/auth/", "/api/notifications", "/api/push", "/api/account", "/api/live"];

// Owner-only area: not even super admins may open it.
const AGENT_ONLY = ["/agent", "/api/agent"];

// Super admin may open everything except the client portal and the owner area.
const ALLOWED: Record<Exclude<Role, "super_admin">, string[]> = {
  team_admin: ["/today", "/projects", "/api/projects", "/tickets", "/api/tickets", "/queries", "/api/queries", "/submissions", "/api/onboarding", "/account"],
  client: ["/portal", "/api/portal"],
  // The hidden owner account: its own pages, read-only reports, and its profile.
  agent: ["/agent", "/api/agent", "/reports", "/account"],
};

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  const role = session.role;
  const allowed =
    matches(pathname, SHARED) ||
    (role === "super_admin" ? !matches(pathname, ALLOWED.client) && !matches(pathname, AGENT_ONLY) : matches(pathname, ALLOWED[role]));
  if (allowed) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "You do not have access to this" }, { status: 403 });
  const url = req.nextUrl.clone();
  url.pathname = homeFor(role);
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
