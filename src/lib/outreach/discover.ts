/**
 * Finds local businesses from OpenStreetMap (free, no API key, data under ODbL).
 * Nominatim turns "Houston, TX" into an area; Overpass lists businesses of a category inside it
 * with whatever public contact tags the community has added (website, email, phone, address).
 * Both services ask for a real User-Agent and light use, so we cache areas and query one city at a time.
 */

const UA = "ZoxenPortal/1.0 (business outreach; contact: support@zoxendigital.com)";

/** Portal categories -> OpenStreetMap tags. */
export const CATEGORY_TAGS: Record<string, string[]> = {
  restaurant: ['["amenity"="restaurant"]'],
  cafe: ['["amenity"="cafe"]'],
  "fast food": ['["amenity"="fast_food"]'],
  bakery: ['["shop"="bakery"]'],
  bar: ['["amenity"="bar"]', '["amenity"="pub"]'],
  dentist: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  clinic: ['["amenity"="clinic"]', '["healthcare"="clinic"]'],
  "beauty salon": ['["shop"="beauty"]', '["shop"="hairdresser"]'],
  spa: ['["leisure"="spa"]', '["shop"="massage"]'],
  gym: ['["leisure"="fitness_centre"]'],
  "car repair": ['["shop"="car_repair"]'],
  "real estate": ['["office"="estate_agent"]'],
  lawyer: ['["office"="lawyer"]'],
  accountant: ['["office"="accountant"]'],
  hotel: ['["tourism"="hotel"]', '["tourism"="guest_house"]'],
  florist: ['["shop"="florist"]'],
  "pet services": ['["shop"="pet_grooming"]', '["amenity"="veterinary"]'],
};

/** Big brands are not our customers. */
const CHAINS =
  /\b(mcdonald|starbucks|subway|burger king|wendy|taco bell|kfc|domino|pizza hut|papa john|chipotle|panera|dunkin|chick-fil-a|popeyes|sonic|arby|jack in the box|ihop|denny|applebee|olive garden|chili'?s|panda express|five guys|wingstop|jimmy john|little caesars|dairy queen|whataburger|in-n-out|shake shack|tim hortons|7-eleven|walgreens|cvs|aspen dental|great clips|supercuts|sport clips|planet fitness|la fitness|anytime fitness|marriott|hilton|holiday inn|best western|hampton inn|motel 6|la quinta|jiffy lube|midas|meineke|firestone|re\/max|keller williams|coldwell|century 21|h&r block|jackson hewitt)\b/i;

export type Found = {
  sourceKey: string;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  website: string;
  email: string;
};

const g = globalThis as unknown as { _zxAreas?: Map<string, number> };

async function areaId(city: string) {
  g._zxAreas ??= new Map();
  if (g._zxAreas.has(city)) return g._zxAreas.get(city)!;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(city)}&countrycodes=us,ca,gb,ae,au`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Location lookup failed (${res.status})`);
  const hits = (await res.json()) as { osm_type: string; osm_id: number; class: string; type: string }[];
  // Prefer the administrative boundary (city limits) over a point.
  const rel = hits.find((h) => h.osm_type === "relation") || hits[0];
  if (!rel) throw new Error(`Could not find "${city}" on the map`);
  const id = rel.osm_type === "relation" ? 3600000000 + rel.osm_id : rel.osm_type === "way" ? 2400000000 + rel.osm_id : 0;
  if (!id) throw new Error(`"${city}" is not an area on the map; try "City, ST"`);
  g._zxAreas.set(city, id);
  return id;
}

const clean = (v?: string) => (v || "").trim().slice(0, 300);

function normalizeUrl(u: string) {
  let s = clean(u).split(/[;\s]/)[0] || "";
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const url = new URL(s);
    if (/facebook\.com|instagram\.com|yelp\.com|google\.|linktr\.ee|ubereats|doordash|grubhub|toasttab|squareup\.com\/store/i.test(url.hostname)) return "";
    return url.origin + (url.pathname === "/" ? "" : url.pathname);
  } catch {
    return "";
  }
}

/** Up to `limit` businesses of `category` in `city`, skipping chains. */
export async function discover(category: string, city: string, limit = 200): Promise<Found[]> {
  const tags = CATEGORY_TAGS[category.toLowerCase()];
  if (!tags) throw new Error(`Unknown category "${category}"`);
  const area = await areaId(city);
  const parts = tags.map((t) => `nwr${t}["name"](area.a);`).join("");
  const q = `[out:json][timeout:50];area(${area})->.a;(${parts});out center tags ${Math.min(limit * 2, 600)};`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(q),
    signal: AbortSignal.timeout(55000),
  });
  if (!res.ok) throw new Error(`Map search failed (${res.status}); it will retry next run`);
  const data = (await res.json()) as { elements: { type: string; id: number; tags: Record<string, string> }[] };
  const out: Found[] = [];
  for (const el of data.elements || []) {
    const t = el.tags || {};
    const name = clean(t.name);
    if (!name || CHAINS.test(name) || t.brand || t["brand:wikidata"]) continue;
    const addr = [t["addr:housenumber"], t["addr:street"], t["addr:city"], t["addr:state"]].filter(Boolean).join(" ");
    out.push({
      sourceKey: `osm:${el.type}/${el.id}`,
      name,
      category: category.toLowerCase(),
      city,
      address: clean(addr),
      phone: clean(t.phone || t["contact:phone"]),
      website: normalizeUrl(t.website || t["contact:website"] || t.url || ""),
      email: clean(t.email || t["contact:email"]).toLowerCase(),
    });
    if (out.length >= limit) break;
  }
  return out;
}
