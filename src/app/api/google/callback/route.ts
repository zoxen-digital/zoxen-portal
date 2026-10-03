import { NextResponse } from "next/server";
import { ADMIN, apiUser } from "@/lib/session";
import { saveGoogleConnection } from "@/lib/google";

/** Google sends the admin back here after they allow access. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => {
    const res = NextResponse.redirect(`${url.origin}/settings?google=${status}`);
    res.cookies.set("zx_g_state", "", { path: "/", maxAge: 0 });
    return res;
  };
  try {
    await apiUser(ADMIN);
  } catch {
    return NextResponse.redirect(`${url.origin}/login`);
  }
  const state = req.headers.get("cookie")?.match(/(?:^|;\s*)zx_g_state=([^;]+)/)?.[1];
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code || !state || state !== url.searchParams.get("state")) return back("failed");
  try {
    await saveGoogleConnection(code, `${url.origin}/api/google/callback`);
    return back("connected");
  } catch (e) {
    console.error("Google connect failed:", e);
    return back("failed");
  }
}
