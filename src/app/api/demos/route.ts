import { dbConnect } from "@/lib/db";
import { error, handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { after } from "next/server";
import { classify, cleanSiteUrl, nameFromUrl, readSite, refreshDemoSite, warmScreenshots } from "@/lib/demos";
import { DEMO_INDUSTRIES, DemoSite } from "@/models/DemoSite";

export const maxDuration = 60;

export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  return json({ items: await DemoSite.find().sort({ createdAt: -1 }).lean(), industries: DEMO_INDUSTRIES });
});

/**
 * Add one or many sites (up to 40 per call). Each URL is opened to read its title; name and
 * industry are filled in automatically unless given. Sites already in the list are skipped.
 */
export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  const b = await req.json().catch(() => ({}));
  const raw: string[] = typeof b.urls === "string" ? b.urls.split(/[\s,]+/) : Array.isArray(b.urls) ? b.urls : [];
  const urls = [...new Set(raw.map(cleanSiteUrl).filter(Boolean))].slice(0, 40);
  if (!urls.length) return error("Paste at least one website link");
  await dbConnect();
  const have = new Set((await DemoSite.find({ url: { $in: urls } }).select("url").lean<{ url: string }[]>()).map((d) => d.url));
  const fresh = urls.filter((u) => !have.has(u));
  if (!fresh.length) return json({ added: 0, skipped: urls.length, offline: 0 });
  const read = await Promise.all(fresh.map(async (url) => ({ url, ...(await readSite(url)) })));
  let ai = new Map<string, { name: string; industry: string }>();
  try {
    ai = await classify(read);
  } catch {
    // AI only helps with naming; fall back to the page title / domain and "Other".
  }
  const industry = (DEMO_INDUSTRIES as readonly string[]).includes(b.industry) ? b.industry : "";
  const docs = read.map((s) => ({
    url: s.url,
    name: ai.get(s.url)?.name || s.title || nameFromUrl(s.url),
    industry: industry || ai.get(s.url)?.industry || "Other",
    description: s.description,
    // Sites that do not load are kept but hidden until checked.
    visible: s.ok,
  }));
  await DemoSite.insertMany(docs, { ordered: false }).catch(() => {});
  // Screenshots get made after the response, so they are ready when someone opens the demo page.
  after(async () => {
    await refreshDemoSite();
    await warmScreenshots(docs.filter((d) => d.visible).map((d) => d.url));
  });
  return json({ added: docs.length, skipped: urls.length - fresh.length, offline: docs.filter((d) => !d.visible).length }, 201);
});
