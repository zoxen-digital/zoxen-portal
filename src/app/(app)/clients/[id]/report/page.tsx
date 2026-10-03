import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { validId } from "@/lib/api";
import { buildReport, validMonth } from "@/lib/report";
import { ReportDocument } from "@/components/ReportDocument";
import { ReportControls } from "@/components/ReportControls";

export const metadata = { title: "Monthly report" };

export default async function ClientReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  await pageUser(ADMIN);
  const { id } = await params;
  const { month } = await searchParams;
  if (!validId(id)) notFound();
  const [r, settings] = await Promise.all([buildReport(id, validMonth(month)), getSettings()]);
  if (!r) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/clients/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to client
      </Link>
      <ReportControls basePath={`/clients/${id}/report`} month={r.month} sendUrl={`/api/clients/${id}/report`} fileName={`Report-${(r.client.company || r.client.name).replace(/\s+/g, "-")}-${r.month}`} />
      <ReportDocument r={r} settings={settings} />
    </div>
  );
}
