import { notFound, redirect } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { validId } from "@/lib/api";
import { Client } from "@/models/Client";
import { Quote } from "@/models/Quote";
import { PageHeader } from "@/components/ui";
import { QuoteForm } from "@/components/QuoteForms";
import { serialize } from "@/lib/utils";
import type { QuoteT } from "@/lib/types";
import type { ClientOption } from "@/components/QueryForm";

export const metadata = { title: "Edit quote" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  await pageUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) notFound();
  await dbConnect();
  const [doc, clientDocs, settings] = await Promise.all([Quote.findById(id).lean(), Client.find().sort({ name: 1 }).select("name company").lean(), getSettings()]);
  if (!doc) notFound();
  const quote = serialize<QuoteT>(doc);
  if (quote.status === "Accepted") redirect(`/quotes/${id}`);
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Edit ${quote.number}`} subtitle={quote.status === "Sent" ? "The client already has the link; they will see your changes." : undefined} />
      <QuoteForm clients={serialize<ClientOption[]>(clientDocs)} settings={settings} initial={quote} />
    </div>
  );
}
