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

type Spot = { lat: number; lon: number; r: number };
const g = globalThis as unknown as { _zxSpots?: Map<string, Spot> };

// Public Overpass servers; the main one is often overloaded, so the others are tried in turn.
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

/** City centre and search radius (half the city size, at most 8 km so big cities stay fast). */
async function spot(city: string) {
  g._zxSpots ??= new Map();
  if (g._zxSpots.has(city)) return g._zxSpots.get(city)!;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(city)}&countrycodes=us,ca,gb,ae,au`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Location lookup failed (${res.status})`);
  const hits = (await res.json()) as { osm_type: string; lat: string; lon: string; boundingbox: string[]; place_rank: number }[];
  // Prefer the city boundary (rank ~16) over the county or state with the same name.
  const rels = hits.filter((h) => h.osm_type === "relation").sort((a, b) => Math.abs(a.place_rank - 16) - Math.abs(b.place_rank - 16));
  const hit = rels[0] || hits[0];
  if (!hit) throw new Error(`Could not find "${city}" on the map`);
  // States and countries are too big for one map search; ask for a city instead.
  if ((hit.place_rank || 30) < 12) throw new Error(`"${city}" is a whole state or country; add a city instead, e.g. "Los Angeles, CA"`);
  const [s1, n1, w1, e1] = hit.boundingbox.map(Number);
  const km = Math.hypot((n1 - s1) * 111, (e1 - w1) * 111 * Math.cos((Number(hit.lat) * Math.PI) / 180)) / 2;
  const sp = { lat: Number(hit.lat), lon: Number(hit.lon), r: Math.round(Math.min(8, Math.max(2, km)) * 1000) };
  g._zxSpots.set(city, sp);
  return sp;
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
  const { lat, lon, r } = await spot(city);
  const parts = tags.map((t) => `nwr${t}["name"](around:${r},${lat},${lon});`).join("");
  const q = `[out:json][timeout:25];(${parts});out center tags ${Math.min(limit * 2, 600)};`;
  // The main public server is often busy (502/504); try the mirrors before giving up.
  let res: Response | null = null;
  const until = Date.now() + 45000;
  for (const host of OVERPASS) {
    const left = until - Date.now();
    if (left < 5000) break;
    res = await fetch(host, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
      signal: AbortSignal.timeout(Math.min(40000, left)),
    }).catch(() => null);
    if (res?.ok) break;
  }
  if (!res?.ok) throw new Error(`Map search failed (${res?.status || "timeout"}); it will retry next run`);
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
