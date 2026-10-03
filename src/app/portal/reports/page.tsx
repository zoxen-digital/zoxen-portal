import { pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { buildReport, validMonth } from "@/lib/report";
import { ReportDocument } from "@/components/ReportDocument";
import { ReportControls } from "@/components/ReportControls";

export const metadata = { title: "Monthly report" };

export default async function PortalReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await pageUser(["client"]);
  const { month } = await searchParams;
  const [r, settings] = await Promise.all([buildReport(user.clientId!, validMonth(month)), getSettings()]);
  if (!r) return <p className="text-sm text-muted">No report available.</p>;
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-[860px]">
        <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[28px]">Monthly report</h1>
        <p className="mt-1 text-sm text-muted">What we delivered, invoices and payments for any month.</p>
      </div>
      <ReportControls basePath="/portal/reports" month={r.month} fileName={`Report-${r.month}`} />
      <ReportDocument r={r} settings={settings} />
    </div>
  );
}
