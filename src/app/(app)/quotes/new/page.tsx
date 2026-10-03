import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Client } from "@/models/Client";
import { PageHeader } from "@/components/ui";
import { QuoteForm } from "@/components/QuoteForms";
import { serialize } from "@/lib/utils";
import type { ClientOption } from "@/components/QueryForm";

export const metadata = { title: "New quote" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await pageUser(ADMIN);
  const sp = await searchParams;
  await dbConnect();
  const [clientDocs, settings] = await Promise.all([Client.find().sort({ name: 1 }).select("name company").lean(), getSettings()]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="New quote" subtitle="Save as draft to review, or send it straight to the client." />
      <QuoteForm clients={serialize<ClientOption[]>(clientDocs)} settings={settings} defaultClientId={sp.client} />
    </div>
  );
}
