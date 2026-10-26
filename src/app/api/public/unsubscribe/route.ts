import { dbConnect } from "@/lib/db";
import { readUnsubToken } from "@/lib/outreach/secure";
import { OutreachProspect, Suppression } from "@/models/Outreach";

/**
 * Unsubscribe from outreach emails. GET shows a confirm page; POST (including Gmail/Yahoo
 * one-click unsubscribe, RFC 8058) adds the address to the do-not-contact list immediately.
 */

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;font-family:Segoe UI,Helvetica,Arial,sans-serif;background:#f6f7fc;color:#1a1d2e"><div style="max-width:440px;margin:12vh auto;background:#fff;border-radius:20px;padding:32px;box-shadow:0 10px 30px -14px rgba(15,23,42,.2);text-align:center">${body}</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );

async function suppress(email: string) {
  await dbConnect();
  await Suppression.updateOne({ email }, { $setOnInsert: { email, reason: "unsubscribed" } }, { upsert: true });
  await OutreachProspect.updateMany({ email, stage: { $in: ["ready", "sent", "audited", "completed", "replied"] } }, { $set: { stage: "unsubscribed", nextSendAt: null } });
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") || "";
  const email = readUnsubToken(t);
  if (!email) return page("Link not valid", `<h2>Link not valid</h2><p>This unsubscribe link is broken. Reply "unsubscribe" to the email instead and we will remove you.</p>`);
  return page(
    "Unsubscribe",
    `<h2 style="margin:0 0 8px">Unsubscribe?</h2><p style="color:#6b7085">We will stop emailing <b>${email.replace(/[<>&"]/g, "")}</b>.</p><form method="post"><input type="hidden" name="t" value="${t.replace(/[<>&"]/g, "")}"><button style="margin-top:12px;background:#0b1020;color:#fff;border:0;border-radius:999px;padding:12px 26px;font-size:15px;cursor:pointer">Unsubscribe</button></form>`
  );
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let t = url.searchParams.get("t") || "";
  if (!t) {
    const form = await req.formData().catch(() => null);
    t = String(form?.get("t") || "");
  }
  const email = readUnsubToken(t);
  if (!email) return page("Link not valid", `<h2>Link not valid</h2>`);
  await suppress(email);
  return page("Unsubscribed", `<h2 style="margin:0 0 8px">You're unsubscribed</h2><p style="color:#6b7085">You won't receive any more emails from us. Sorry for the bother.</p>`);
}
