import { dbConnect } from "@/lib/db";
import { handle } from "@/lib/api";
import { DEMO_INDUSTRIES, DemoSite, industrySlug } from "@/models/DemoSite";

/** Read-only list for demo.zoxendigital.com, cached at the edge for 5 minutes. */
const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};

export const OPTIONS = () => new Response(null, { status: 204, headers: HEADERS });

export const GET = handle(async () => {
  await dbConnect();
  const sites = await DemoSite.find({ visible: true })
    .sort({ createdAt: -1 })
    .select("url name industry description")
    .lean<{ url: string; name: string; industry: string; description: string }[]>();
  const industries = DEMO_INDUSTRIES.map((name) => ({ name, slug: industrySlug(name), count: sites.filter((s) => s.industry === name).length })).filter((i) => i.count);
  const body = { industries, sites: sites.map((s) => ({ url: s.url, name: s.name, industry: s.industry, slug: industrySlug(s.industry), description: s.description })) };
  return new Response(JSON.stringify(body), { headers: HEADERS });
});
