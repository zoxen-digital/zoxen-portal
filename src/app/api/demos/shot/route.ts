import { error, handle } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { cleanSiteUrl, screenshotSource } from "@/lib/demos";

/** Screenshot for the Demo Websites page, kept in the browser cache for a week so the page opens instantly next time. */
export const GET = handle(async (req: Request) => {
  await apiUser(ADMIN);
  const url = cleanSiteUrl(new URL(req.url).searchParams.get("u") || "");
  if (!url) return error("Not found", 404);
  const res = await fetch(screenshotSource(url), { signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (!res?.ok) return new Response("Screenshot not ready", { status: 502, headers: { "Cache-Control": "no-store" } });
  return new Response(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") || "image/png", "Cache-Control": "private, max-age=604800, stale-while-revalidate=604800" },
  });
});
