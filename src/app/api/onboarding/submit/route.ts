import { timingSafeEqual } from "crypto";
import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";
import { error, json } from "@/lib/api";

/**
 * Public endpoint for the onboarding form on the other website.
 * POST JSON or form data. Requires header `x-api-key: ONBOARDING_API_KEY` when that env var is set.
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
  if (!expected) return true;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const first = (obj: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return "";
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function POST(req: Request) {
  const headers = cors();
  const url = new URL(req.url);
  if (!keyMatches(req.headers.get("x-api-key") || url.searchParams.get("key"))) {
    return error("Invalid API key", 401, headers);
  }

  let body: Record<string, unknown> = {};
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      body = await req.json();
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v !== "string") continue;
        if (k in body) body[k] = ([] as unknown[]).concat(body[k], v);
        else body[k] = v;
      }
    }
  } catch {
    return error("Invalid request body", 400, headers);
  }

  const name = first(body, ["name", "fullName", "full_name", "clientName", "client_name", "firstName"]);
  if (!name) return error("Name is required", 400, headers);

  const rawServices = body.services ?? body.service ?? [];
  const services = (Array.isArray(rawServices) ? rawServices : String(rawServices).split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);

  try {
    await dbConnect();
    const doc = await Onboarding.create({
      name,
      email: first(body, ["email", "emailAddress", "email_address"]),
      phone: first(body, ["phone", "phoneNumber", "phone_number", "whatsapp", "mobile"]),
      company: first(body, ["company", "business", "businessName", "business_name", "companyName"]),
      website: first(body, ["website", "websiteUrl", "website_url", "url"]),
      services,
      budget: first(body, ["budget", "budgetRange", "budget_range"]),
      message: first(body, ["message", "details", "description", "requirements", "notes"]),
      data: body,
    });
    return json({ ok: true, id: doc._id }, 201, headers);
  } catch (e) {
    console.error(e);
    return error("Could not save submission", 500, headers);
  }
}
