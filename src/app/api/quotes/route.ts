import { dbConnect } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { Client } from "@/models/Client";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { nextNumber } from "@/lib/docs";
import { newPublicId } from "@/lib/invoices";
import { quoteData, sendQuote } from "@/lib/quotes";

export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  return json(await Quote.find().sort({ createdAt: -1 }).limit(500).populate("client", "name company").lean());
});

/** Body: quote fields + { client, send?: boolean } */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(ADMIN);
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  if (!body.client || !validId(String(body.client)) || !(await Client.exists({ _id: body.client }))) return error("Choose a client");
  const quote = await Quote.create({
    ...quoteData(body),
    client: body.client,
    number: await nextNumber(Quote, "Q"),
    publicId: newPublicId(),
    status: "Draft",
  });
  const via = body.send ? await sendQuote(quote, user) : null;
  return json({ quote, via }, 201);
});
