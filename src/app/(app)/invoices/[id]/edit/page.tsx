import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "@/components/InvoiceForm";
import type { ClientOption } from "@/components/QueryForm";
import { serialize } from "@/lib/utils";
import type { InvoiceT } from "@/lib/types";

export const metadata = { title: "Edit Invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await dbConnect();
  const [doc, clients, settings] = await Promise.all([
    Invoice.findById(id).lean(),
    Client.find().sort({ name: 1 }).select("name company").lean(),
    getSettings(),
  ]);
  if (!doc) notFound();
  const invoice = serialize<InvoiceT>(doc);

  return (
    <div>
      <Link href={`/invoices/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to invoice
      </Link>
      <PageHeader title={`Edit ${invoice.invoiceNumber}`} subtitle="Changes show on the client link immediately." />
      <InvoiceForm clients={serialize<ClientOption[]>(clients)} settings={settings} initial={invoice} />
    </div>
  );
}
