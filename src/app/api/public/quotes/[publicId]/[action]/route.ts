import { dbConnect } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { error, handle, json } from "@/lib/api";
import { clientIp } from "@/lib/docs";
import { acceptQuote } from "@/lib/quotes";
import { notify, superAdminIds } from "@/lib/notify";

type Ctx = { params: Promise<{ publicId: string; action: string }> };

/**
 * Public (no login) actions from the proposal link:
 *  accept  { name, agree: true }  -> signature recorded, invoice + project created
 *  decline { reason? }
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { publicId, action } = await params;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(publicId)) return error("Quote not found", 404);
  await dbConnect();
  const quote = await Quote.findOne({ publicId, status: { $ne: "Draft" } });
  if (!quote) return error("Quote not found", 404);
  const body = await req.json().catch(() => ({}));

  if (action === "accept") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (name.length < 2) return error("Type your full name to accept");
    if (body.agree !== true) return error("Please tick the box to agree to the terms");
    const { invoice } = await acceptQuote(quote, { name, ip: clientIp(req), ua: req.headers.get("user-agent") || "" });
    return json({ ok: true, invoicePublicId: invoice.publicId });
  }

  if (action === "decline") {
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
    const updated = await Quote.findOneAndUpdate(
      { _id: quote._id, status: "Sent" },
      { $set: { status: "Declined", declinedAt: new Date(), declineReason: reason } }
    );
    if (!updated) return error("This quote can no longer be declined");
    await notify(await superAdminIds(), {
      title: `Quote declined: ${quote.number}`,
      body: reason ? `Reason: ${reason}` : quote.title,
      link: `/quotes/${quote._id}`,
      email: { button: "Open quote" },
    });
    return json({ ok: true });
  }

  return error("Not found", 404);
});
