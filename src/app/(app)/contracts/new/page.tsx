import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { validId } from "@/lib/api";
import { DEFAULT_CONTRACT, fillTemplate } from "@/lib/contracts";
import { Client } from "@/models/Client";
import { Quote } from "@/models/Quote";
import { Project } from "@/models/Project";
import { PageHeader } from "@/components/ui";
import { ContractForm } from "@/components/ContractForms";
import { serialize } from "@/lib/utils";
import type { ClientT } from "@/lib/types";

export const metadata = { title: "New contract" };

type SP = Promise<{ client?: string; quote?: string; project?: string }>;

/** Step 1: pick the client (and optionally a quote / project). Step 2: edit the pre-filled agreement. */
export default async function NewContractPage({ searchParams }: { searchParams: SP }) {
  await pageUser(ADMIN);
  const sp = await searchParams;
  await dbConnect();
  const clientId = sp.client && validId(sp.client) ? sp.client : "";
  const [clientDocs, settings, client, quotes, projects] = await Promise.all([
    Client.find().sort({ name: 1 }).select("name company").lean(),
    getSettings(),
    clientId ? Client.findById(clientId).lean<{ name: string; company?: string }>() : null,
    clientId ? Quote.find({ client: clientId, status: { $ne: "Draft" } }).sort({ createdAt: -1 }).select("number title totals currency").lean() : [],
    clientId ? Project.find({ client: clientId }).sort({ createdAt: -1 }).select("title").lean() : [],
  ]);
  const clients = serialize<ClientT[]>(clientDocs);
  const quote = (quotes as { _id: unknown; number: string; title: string; totals?: { total?: number }; currency: string }[]).find((q) => String(q._id) === sp.quote);
  const project = (projects as { _id: unknown; title: string }[]).find((p) => String(p._id) === sp.project);

  const body =
    client &&
    fillTemplate(settings.contractTemplate?.trim() || DEFAULT_CONTRACT, {
      companyName: settings.companyName,
      clientName: client.name,
      clientCompany: client.company,
      project: quote?.title || project?.title,
      total: quote?.totals?.total,
      currency: quote?.currency,
      paymentTerms: settings.defaultTerms,
    });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="New contract" subtitle="The text starts from your template (Settings). Edit anything before sending." />
      <form action="/contracts/new" className="card grid gap-3 p-5 sm:grid-cols-4 sm:items-end">
        <label className="sm:col-span-2">
          <span className="label">Client *</span>
          <select name="client" defaultValue={clientId} className="input" required>
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </select>
        </label>
        {clientId && (
          <>
            <label>
              <span className="label">Based on quote</span>
              <select name="quote" defaultValue={sp.quote || ""} className="input">
                <option value="">None</option>
                {(quotes as { _id: unknown; number: string; title: string }[]).map((q) => (
                  <option key={String(q._id)} value={String(q._id)}>{`${q.number} · ${q.title}`}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Project</span>
              <select name="project" defaultValue={sp.project || ""} className="input">
                <option value="">None</option>
                {(projects as { _id: unknown; title: string }[]).map((p) => (
                  <option key={String(p._id)} value={String(p._id)}>{p.title}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <button className="btn btn-outline sm:col-span-4 sm:justify-self-end">{clientId ? "Refresh text" : "Continue"}</button>
      </form>
      {client && body && (
        <ContractForm
          key={`${clientId}-${sp.quote || ""}-${sp.project || ""}`}
          preset={{
            client: clientId,
            quote: quote ? String(quote._id) : undefined,
            project: project ? String(project._id) : undefined,
            title: quote ? `Agreement: ${quote.title}` : project ? `Agreement: ${project.title}` : "Service Agreement",
            body,
          }}
        />
      )}
    </div>
  );
}
