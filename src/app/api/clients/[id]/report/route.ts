import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { buildReport, validMonth } from "@/lib/report";
import { notifyClient } from "@/lib/client-notify";

type Ctx = { params: Promise<{ id: string }> };

/** Sends the month's report to the client (portal + push + email). Body: { month: "YYYY-MM" } */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Client not found", 404);
  const { month } = await req.json().catch(() => ({}));
  const r = await buildReport(id, validMonth(month));
  if (!r) return error("Client not found", 404);
  const via = await notifyClient(
    id,
    {
      title: `Your ${r.label} report is ready`,
      body: "See the work completed, invoices and payments for the month in your portal.",
      link: `/portal/reports?month=${r.month}`,
      button: "View report",
      email: true,
    },
    user
  );
  if (via === "none") return error("This client has no portal login yet. Invite them first, or download the PDF and send it.");
  return json({ ok: true, via });
});
