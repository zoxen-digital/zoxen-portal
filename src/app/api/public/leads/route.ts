import { timingSafeEqual } from "crypto";
import { dbConnect } from "@/lib/db";
import { error, json } from "@/lib/api";
import { notify, superAdminIds } from "@/lib/notify";
import { Query } from "@/models/Query";

/**
 * Website contact form -> Queries.
 * POST JSON or form data with header `x-api-key: ONBOARDING_API_KEY` (same key the website already uses).
 * Fields: name*, email or phone*, company, service, message, budget, source, page.
 * Saves a Pending query with the lead's contact details (no client is created; the team links one later) and alerts super admins.
 */

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": process.env.ONBOARDING_ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };
}

function keyMatches(given: string | null) {
  const expected = process.env.ONBOARDING_API_KEY;
  // Unlike the onboarding endpoint, leads always need the key, so nobody can flood the Queries list.
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function POST(req: Request) {
  const headers = cors();
  if (!keyMatches(req.headers.get("x-api-key"))) return error("Invalid API key", 401, headers);

  let b: Record<string, unknown> = {};
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) b = await req.json();
    else for (const [k, v] of (await req.formData()).entries()) if (typeof v === "string") b[k] = v;
  } catch {
    return error("Could not read the form", 400, headers);
  }

  // Bots fill hidden fields; pretend it worked so they do not retry.
  if (clean(b.hp) || clean(b.honeypot) || clean(b._gotcha)) return json({ ok: true }, 200, headers);

  const name = clean(b.name || b.fullName, 120);
  const email = clean(b.email, 160).toLowerCase();
  const phone = clean(b.phone || b.whatsapp, 40);
  const company = clean(b.company || b.business || b.businessName, 120);
  const service = clean(b.service || b.package, 80);
  const message = clean(b.message || b.details || b.description, 5000);
  const budget = clean(b.budget, 60);
  const source = clean(b.source, 60) || "Website";
  const page = clean(b.page || b.pageUrl, 300);

  if (!name) return error("Name is required", 400, headers);
  if (email && !EMAIL.test(email)) return error("Enter a valid email", 400, headers);
  if (!email && !phone) return error("Email or phone is required", 400, headers);

  try {
    await dbConnect();
    // Same person sending the same message twice in 10 minutes (double click, refresh): keep one.
    const who = email ? { "lead.email": email } : { "lead.phone": phone };
    const dup = await Query.findOne({ ...who, description: message, createdAt: { $gte: new Date(Date.now() - 10 * 60_000) } }).select("_id");
    if (dup) return json({ ok: true, id: dup._id }, 200, headers);

    const query = await Query.create({
      client: null,
      lead: { name, email, phone, company, budget, source, page },
      title: `Website enquiry${service ? `: ${service}` : ""}`,
      service,
      description: message,
      status: "Pending",
      priority: "Medium",
    });

    await notify(await superAdminIds(), {
      title: `New website enquiry: ${company || name}`,
      body: `${service ? `${service} · ` : ""}${message.slice(0, 120) || "No message"}`,
      link: "/queries",
      email: { button: "Open queries" },
    });
    return json({ ok: true, id: query._id }, 201, headers);
  } catch (e) {
    console.error("Website lead failed:", e);
    return error("Could not save your message. Please try again.", 500, headers);
  }
}
