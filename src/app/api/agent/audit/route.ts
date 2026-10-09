import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { handle } from "@/lib/api";
import { AGENT, apiUser } from "@/lib/session";
import { auditFilter } from "@/lib/audit-query";

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV export of the audit log with the same filters as the page. */
export const GET = handle(async (req: Request) => {
  await apiUser(AGENT);
  await dbConnect();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await AuditLog.find(auditFilter(sp)).sort({ at: -1 }).limit(20000).lean<
    { at: Date; actorName?: string; actorRole?: string; action?: string; target?: string; details?: string; ip?: string }[]
  >();
  const lines = [
    ["Time (UTC)", "Who", "Role", "Action", "On", "Details", "IP"].map(csv).join(","),
    ...rows.map((r) => [new Date(r.at).toISOString(), r.actorName, r.actorRole, r.action, r.target, r.details, r.ip].map(csv).join(",")),
  ];
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
