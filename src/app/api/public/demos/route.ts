import { dbConnect } from "@/lib/db";
import { handle } from "@/lib/api";
import { DEMO_INDUSTRIES, DemoSite, industrySlug } from "@/models/DemoSite";

/** Read-only list for demo.zoxendigital.com. Not cached here: the demo site keeps its own copy and is told when it changes. */
const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

export const OPTIONS = () => new Response(null, { status: 204, headers: HEADERS });

export const GET = handle(async () => {
  await dbConnect();
  const sites = await DemoSite.find({ visible: true })
    .sort({ createdAt: -1 })
    .select("url name industry description shot")
    .lean<{ url: string; name: string; industry: string; description: string; shot?: string }[]>();
  const industries = DEMO_INDUSTRIES.map((name) => ({ name, slug: industrySlug(name), count: sites.filter((s) => s.industry === name).length })).filter((i) => i.count);
  const body = { industries, sites: sites.map((s) => ({ url: s.url, name: s.name, industry: s.industry, slug: industrySlug(s.industry), description: s.description, shot: s.shot || "" })) };
  return new Response(JSON.stringify(body), { headers: HEADERS });
});
