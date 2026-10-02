import { dbConnect } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { error, handle, json } from "@/lib/api";

type Ctx = { params: Promise<{ publicId: string }> };

/** The client clicked "Confirm & Pay" on the shared invoice page. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { publicId } = await params;
  await dbConnect();
  const invoice = await Invoice.findOne({ publicId, status: { $nin: ["Draft", "Cancelled"] } });
  if (!invoice) return error("Invoice not found", 404);
  if (!invoice.confirmedAt) {
    invoice.confirmedAt = new Date();
    await invoice.save();
  }
  return json({ ok: true, confirmedAt: invoice.confirmedAt });
});
