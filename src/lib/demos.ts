import { gemini } from "./ai";
import { DEMO_INDUSTRIES } from "@/models/DemoSite";

/** "example.com/x" -> "https://example.com" (site root, lowercase host). */
export function cleanSiteUrl(raw: string) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes(".")) return "";
    return `https://${u.hostname.toLowerCase().replace(/^www\./, "")}`;
  } catch {
    return "";
  }
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/g, "-")
    .replace(/\s+/g, " ")
    .trim();

function meta(html: string, name: string) {
  const a = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"));
  return a?.[1] || b?.[1] || "";
}

/** Title and description from the homepage (ok = false when the site does not load). */
export async function readSite(url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ZoxenDemos/1.0)" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return { ok: false, title: "", description: "" };
    const html = (await res.text()).slice(0, 300_000);
    const title = decode(meta(html, "og:site_name") || meta(html, "og:title") || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "");
    return { ok: true, title: title.slice(0, 120), description: decode(meta(html, "description") || meta(html, "og:description")).slice(0, 300) };
  } catch {
    return { ok: false, title: "", description: "" };
  }
}

/** Homepage screenshot from the free service (same size the demo site uses, so both share one render). */
export const screenshotSource = (url: string) => `https://image.thum.io/get/width/640/crop/1000/noanimate/${url}`;

/** Asks the service to make the screenshots now, so the first visitor does not wait for them. */
export async function warmScreenshots(urls: string[]) {
  for (let i = 0; i < urls.length; i += 5) {
    await Promise.all(urls.slice(i, i + 5).map((u) => fetch(screenshotSource(u), { signal: AbortSignal.timeout(30000) }).then((r) => r.arrayBuffer()).catch(() => null)));
  }
}

/** Readable name from the domain when nothing better is known: "theunionshawarma.ca" -> "Theunionshawarma". */
export function nameFromUrl(url: string) {
  const h = new URL(url).hostname.split(".")[0] || url;
  return h.charAt(0).toUpperCase() + h.slice(1);
}

/** Short business name + industry for up to ~40 sites in one cheap AI call. */
export async function classify(sites: { url: string; title: string; description: string }[]) {
  const text = await gemini({
    fast: true,
    json: true,
    temperature: 0.1,
    maxTokens: 4000,
    system: `You sort business websites into industries. Allowed industries (use exactly one of): ${DEMO_INDUSTRIES.join(" | ")}.
For each site return a short clean business name (2-5 words, no taglines, proper capitals; work it out from the title or, if there is none, from the domain) and the best industry.
Return JSON {"items":[{"url":"...","name":"...","industry":"..."}]} in the same order as given.`,
    turns: [{ role: "user", text: sites.map((s) => `${s.url} | ${s.title || "-"} | ${s.description || "-"}`).join("\n") }],
  });
  const items = (JSON.parse(text) as { items?: { url: string; name: string; industry: string }[] }).items || [];
  return new Map(
    items.map((i) => [
      cleanSiteUrl(i.url),
      { name: String(i.name || "").slice(0, 80), industry: (DEMO_INDUSTRIES as readonly string[]).includes(i.industry) ? i.industry : "Other" },
    ])
  );
}
