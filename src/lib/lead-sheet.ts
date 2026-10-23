/**
 * Turns a spreadsheet (CSV or Excel rows) into leads: finds the header row, matches common column
 * names from LinkedIn, Sales Navigator, Apollo and similar exports, and keeps every other column as extra.
 * Shared by the browser (preview) and the server (import).
 */

export type LeadFields = { name: string; company: string; title: string; email: string; phone: string; linkedin: string; instagram: string; location: string; website: string };
type Key = keyof LeadFields | "first" | "last";

const SYNONYMS: Record<Key, string[]> = {
  name: ["name", "full name", "fullname", "contact name", "contact", "person name", "lead name"],
  first: ["first name", "firstname", "first", "given name"],
  last: ["last name", "lastname", "last", "surname", "family name"],
  company: ["company", "company name", "organization", "organisation", "current company", "account name", "business", "business name", "employer"],
  title: ["title", "position", "job title", "headline", "designation", "current title", "role", "occupation"],
  email: ["email", "email address", "e-mail", "work email", "business email", "personal email", "emails"],
  phone: ["phone", "phone number", "mobile", "mobile number", "whatsapp", "contact number", "phones", "telephone", "work phone"],
  instagram: ["instagram", "instagram handle", "instagram username", "ig", "ig handle", "insta", "instagram url", "username", "handle"],
  linkedin: ["linkedin", "linkedin url", "url", "profile url", "linkedin profile", "person linkedin url", "profile link", "public profile url", "linkedin profile url", "profile"],
  location: ["location", "city", "country", "region", "geography", "address", "state"],
  website: ["website", "company website", "domain", "company domain", "site", "web"],
};

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ");

function keyFor(header: string): Key | null {
  const h = norm(header);
  for (const k of Object.keys(SYNONYMS) as Key[]) if (SYNONYMS[k].includes(h)) return k;
  return null;
}

/** Index of the header row: the first of the top 15 rows with at least 2 recognised column names. */
export function headerRow(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const known = (rows[i] || []).filter((c) => keyFor(String(c ?? ""))).length;
    if (known >= 2) return i;
  }
  return 0;
}

/** Which lead field each column feeds (null = goes to extra). */
export function mapColumns(headers: unknown[]) {
  const seen = new Set<Key>();
  return headers.map((h) => {
    const k = keyFor(String(h ?? ""));
    if (!k || seen.has(k)) return null;
    seen.add(k);
    return k;
  });
}

const cell = (v: unknown, max = 300) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim().slice(0, max));

/** One sheet row -> a lead, or null for an empty row. */
export function rowToLead(headers: unknown[], map: (Key | null)[], row: unknown[]) {
  const f: LeadFields = { name: "", company: "", title: "", email: "", phone: "", linkedin: "", instagram: "", location: "", website: "" };
  let first = "";
  let last = "";
  const extra: Record<string, string> = {};
  headers.forEach((h, i) => {
    const v = cell(row[i]);
    if (!v) return;
    const k = map[i];
    if (k === "first") first = v;
    else if (k === "last") last = v;
    else if (k) f[k] = v;
    else if (Object.keys(extra).length < 30) extra[cell(h, 60).replace(/[.$]/g, " ") || `Column ${i + 1}`] = v;
  });
  if (!f.name) f.name = [first, last].filter(Boolean).join(" ");
  f.email = f.email.toLowerCase();
  if (f.linkedin && !/^https?:\/\//i.test(f.linkedin) && /linkedin\.com/i.test(f.linkedin)) f.linkedin = `https://${f.linkedin}`;
  // "@handle" or a profile URL both become a bare handle.
  if (f.instagram) f.instagram = f.instagram.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?].*$/, "").trim();
  if (!f.name && !f.email && !f.linkedin && !f.instagram && !f.phone && !f.company) return null;
  return { ...f, extra };
}

/** Minimal CSV parser (quotes, commas inside quotes, CRLF, semicolon or tab separated files). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "");
  const firstLine = t.split(/\r?\n/, 1)[0] || "";
  const sep = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]!;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}
