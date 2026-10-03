import { dbConnect } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { quoteData, sendQuote } from "@/lib/quotes";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!validId(id)) return null;
  await dbConnect();
  return Quote.findById(id);
}

/**
 * Full edit (only before the client accepts), or an action:
 * { action: "send" | "decline" | "expire" | "reopen" }
 */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  const quote = await load(id);
  if (!quote) return error("Quote not found", 404);
  const body = await req.json().catch(() => ({}));

  if (body.action) {
    if (quote.status === "Accepted") return error("This quote is already accepted");
    if (body.action === "send") {
      const via = await sendQuote(quote, user);
      return json({ quote, via });
    }
    if (body.action === "decline") quote.set({ status: "Declined", declinedAt: new Date(), declineReason: "Marked declined by the team" });
    else if (body.action === "expire") quote.status = "Expired";
    else if (body.action === "reopen") quote.status = "Draft";
    else return error("Unknown action");
    await quote.save();
    return json({ quote });
  }

  if (quote.status === "Accepted") return error("An accepted quote cannot be edited");
  quote.set(quoteData(body));
  await quote.save();
  return json({ quote });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  const quote = await load(id);
  if (!quote) return json({ ok: true });
  if (quote.status === "Accepted") return error("Accepted quotes are kept as a record (the invoice and project came from it)");
  await quote.deleteOne();
  return json({ ok: true });
});
