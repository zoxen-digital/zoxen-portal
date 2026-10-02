import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Client } from "@/models/Client";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/InvoiceForm";
import type { ClientOption } from "@/components/QueryForm";
import { serialize } from "@/lib/utils";

export const metadata = { title: "Create Invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  await dbConnect();
  const [clients, settings] = await Promise.all([Client.find().sort({ name: 1 }).select("name company").lean(), getSettings()]);

  return (
    <div>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>
      <PageHeader title="Create Invoice" subtitle="Add the requirement, pricing and extra costs. A shareable client link is generated on save." />
      <InvoiceForm clients={serialize<ClientOption[]>(clients)} settings={settings} defaultClientId={client} />
    </div>
  );
}
