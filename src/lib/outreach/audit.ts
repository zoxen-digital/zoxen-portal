import { resolveMx } from "dns/promises";

/**
 * Website checks done in code (no AI, no tokens): every finding is something we actually measured,
 * so outreach never claims a problem the site does not have. Also pulls public business emails
 * from the homepage and contact/about pages.
 */

const UA = "Mozilla/5.0 (compatible; ZoxenAudit/1.0; +https://zoxendigital.com)";
const YEAR = new Date().getFullYear();

export type Audit = {
  checkedAt: Date;
  reachable: boolean;
  https: boolean;
  mobile: boolean;
  loadMs: number;
  title: string;
  platform: string;
  copyrightYear: number | null;
  hasOrdering: boolean;
  hasBooking: boolean;
  menuPdf: boolean;
  placeholder: boolean;
  findings: string[];
  score: number;
};

async function get(url: string, ms = 10000) {
  const t = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    const type = res.headers.get("content-type") || "";
    const html = type.includes("html") || type.includes("text") ? (await res.text()).slice(0, 600_000) : "";
    return { ok: res.ok, status: res.status, url: res.url, html, ms: Date.now() - t };
  } catch {
    return { ok: false, status: 0, url, html: "", ms: Date.now() - t };
  }
}

const EMAIL_RX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const BAD_EMAIL = /(example\.|sentry|wixpress|godaddy|squarespace|domain\.com|email\.com|yourdomain|@2x|\.png|\.jpg|\.webp|\.gif|\.svg|noreply|no-reply|^(email|name|your|yourname|user|test|info@example|someone)@|@(address|yoursite|website|company|business)\.com|donotreply|privacy@|abuse@|webmaster@|postmaster@)/i;

/** Public emails on a page, best first (same domain as the site, then info/contact/hello/owner). */
export function emailsIn(html: string, siteHost?: string) {
  const decoded = html.replace(/&#64;|%40|\[at\]|\(at\)/gi, "@").replace(/&#46;|\[dot\]|\(dot\)/gi, ".");
  const found = new Set<string>();
  for (const m of decoded.matchAll(EMAIL_RX)) {
    const e = m[0].toLowerCase().replace(/^mailto:/, "").replace(/\.$/, "");
    if (!BAD_EMAIL.test(e) && e.length < 80) found.add(e);
  }
  const host = (siteHost || "").replace(/^www\./, "");
  const rank = (e: string) => (host && e.endsWith("@" + host) ? 0 : 2) + (/^(info|contact|hello|owner|manager|office|admin|catering|events|reservations)@/.test(e) ? 0 : 1);
  return [...found].sort((a, b) => rank(a) - rank(b));
}

/** Syntax + the domain must accept mail (MX record). Cached per domain. */
const mxCache = new Map<string, boolean>();
export async function deliverable(email: string) {
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i.test(email) || BAD_EMAIL.test(email)) return false;
  const domain = email.split("@")[1]!.toLowerCase();
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  let ok = false;
  try {
    ok = (await resolveMx(domain)).length > 0;
  } catch {
    ok = false;
  }
  mxCache.set(domain, ok);
  return ok;
}

function platformOf(html: string) {
  if (/wix\.com|wixstatic/i.test(html)) return "Wix";
  if (/squarespace/i.test(html)) return "Squarespace";
  if (/wp-content|wordpress/i.test(html)) return "WordPress";
  if (/godaddy|websites\.godaddy|img1\.wsimg/i.test(html)) return "GoDaddy";
  if (/shopify/i.test(html)) return "Shopify";
  if (/weebly/i.test(html)) return "Weebly";
  return "";
}

/** Checks a business website and returns measured findings plus any public emails. */
export async function auditSite(website: string): Promise<{ audit: Audit; emails: string[] }> {
  const empty: Audit = {
    checkedAt: new Date(),
    reachable: false,
    https: false,
    mobile: false,
    loadMs: 0,
    title: "",
    platform: "",
    copyrightYear: null,
    hasOrdering: false,
    hasBooking: false,
    menuPdf: false,
    placeholder: false,
    findings: [],
    score: 0,
  };
  const home = await get(website);
  if (!home.ok || !home.html) {
    const httpTry = website.startsWith("https://") ? await get(website.replace("https://", "http://"), 8000) : null;
    if (!httpTry?.ok) {
      return { audit: { ...empty, findings: [home.status ? `Website returns an error (${home.status})` : "Website does not load (domain down or not responding)"], score: 10 }, emails: [] };
    }
    Object.assign(home, httpTry);
  }
  const html = home.html;
  const host = new URL(home.url).hostname;
  const a: Audit = { ...empty, reachable: true, loadMs: home.ms };
  a.https = home.url.startsWith("https://");
  a.mobile = /<meta[^>]+name=["']viewport["']/i.test(html);
  a.title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim().slice(0, 120);
  a.platform = platformOf(html);
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map((m) => Number(m[1])).filter((y) => y <= YEAR);
  a.copyrightYear = years.length ? Math.max(...years) : null;
  a.hasOrdering = /order\s*online|order\s*now|online\s*order|toasttab|doordash|ubereats|grubhub|chownow|square\.site|clover\.com|menufy|slice/i.test(html);
  a.hasBooking = /book\s*(now|online|a table|an appointment)|reserv(e|ation)|opentable|resy\.com|yelp\.com\/reservations|calendly|vagaro|booksy|zocdoc|acuity/i.test(html);
  a.menuPdf = /href=["'][^"']*menu[^"']*\.pdf/i.test(html);
  a.placeholder = /coming soon|launching soon|under construction|website coming|this domain|domain (is )?for sale|parked/i.test(a.title + " " + html.slice(0, 4000)) && html.length < 60_000;

  const f: string[] = [];
  if (a.placeholder) f.push(`The website is only a "coming soon" / placeholder page`);
  if (!a.https) f.push("The site is not secure (no https), so browsers show a warning");
  if (!a.mobile) f.push("The site is not mobile-friendly (no mobile layout), and most visitors are on phones");
  if (a.loadMs > 4000) f.push(`The homepage took ${(a.loadMs / 1000).toFixed(1)}s to load`);
  if (a.menuPdf) f.push("The menu is a PDF, which is hard to read on a phone");
  if (a.copyrightYear && a.copyrightYear <= YEAR - 3) f.push(`The footer still says ${a.copyrightYear}, so the site looks out of date`);
  if (!a.title) f.push("The homepage has no page title, which hurts Google search");
  if (!a.placeholder && !a.hasOrdering && !a.hasBooking) f.push("There is no way to order or book online from the site");
  a.findings = f;
  // 100 = nothing to fix.
  a.score = Math.max(5, 100 - f.length * 15 - (a.placeholder ? 30 : 0));

  // Public emails: homepage first, then common contact pages.
  let emails = emailsIn(html, host);
  if (!emails.length) {
    const base = new URL(home.url).origin;
    const linked = [...html.matchAll(/href=["']([^"'#]*(?:contact|about)[^"'#]*)["']/gi)].map((m) => m[1]!).slice(0, 2);
    for (const p of [...linked, "/contact", "/contact-us", "/about"]) {
      let url: string;
      try {
        url = new URL(p, base).toString();
      } catch {
        continue;
      }
      const page = await get(url, 7000);
      emails = emailsIn(page.html, host);
      if (emails.length) break;
    }
  }
  return { audit: a, emails };
}
