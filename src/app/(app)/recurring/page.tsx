import Link from "next/link";
import { Repeat } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { calcTotals } from "@/lib/invoice-calc";
import { RecurringPlan } from "@/models/RecurringPlan";
import { Client } from "@/models/Client";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { SectionTabs } from "@/components/DealTabs";
import { DeleteButton, StatusSelect } from "@/components/actions";
import { NewRecurringButton, RecurringRowActions } from "@/components/RecurringForms";
import { formatDate, formatMoney, serialize } from "@/lib/utils";
import type { ClientT, RecurringPlanT } from "@/lib/types";
import type { ClientOption } from "@/components/QueryForm";

export const metadata = { title: "Recurring invoices" };

const EVERY: Record<string, string> = { monthly: "Monthly", quarterly: "Every 3 months", yearly: "Yearly" };
const PER_MONTH: Record<string, number> = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

export default async function RecurringPage() {
  await pageUser(ADMIN);
  await dbConnect();
  const [docs, clientDocs, settings] = await Promise.all([
    RecurringPlan.find().sort({ active: -1, nextRunAt: 1 }).populate("client", "name company").lean(),
    Client.find().sort({ name: 1 }).select("name company").lean(),
    getSettings(),
  ]);
  const plans = serialize<RecurringPlanT[]>(docs);
  const clients = serialize<ClientOption[]>(clientDocs);
  const formSettings = {
    defaultCurrency: settings.defaultCurrency,
    defaultTaxPercent: settings.defaultTaxPercent,
    defaultDueDays: settings.defaultDueDays,
    defaultNotes: settings.defaultNotes,
    defaultTerms: settings.defaultTerms,
  };
  const total = (p: RecurringPlanT) => calcTotals({ items: p.items, extraCosts: [], discountType: p.discountType, discountValue: p.discountValue, taxPercent: p.taxPercent, paid: 0 }).total;
  // Monthly recurring revenue in the default currency (plans in other currencies are listed but not summed).
  const mrr = plans.filter((p) => p.active && p.currency === settings.defaultCurrency).reduce((s, p) => s + total(p) * (PER_MONTH[p.interval] || 1), 0);

  return (
    <div>
      <SectionTabs group="billing" current="/recurring" />
      <PageHeader title="Recurring invoices" subtitle="Maintenance, SEO and ads retainers bill themselves: invoice created and sent to the client on each date.">
        <NewRecurringButton clients={clients} settings={formSettings} />
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Repeat} label="Active plans" value={plans.filter((p) => p.active).length} tone="blue" />
        <StatCard icon={Repeat} label="Monthly recurring revenue" value={formatMoney(mrr, settings.defaultCurrency)} tone="green" />
        <StatCard icon={Repeat} label="Invoices created so far" value={plans.reduce((s, p) => s + (p.invoicesCreated || 0), 0)} tone="violet" />
      </div>
      <div className="card overflow-hidden">
        {plans.length === 0 ? (
          <EmptyState icon={Repeat} title="No recurring invoices yet" text="Set up monthly billing once, and it runs on its own." />
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Repeats</th>
                  <th>Next invoice</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const c = p.client as ClientT | null;
                  return (
                    <tr key={p._id} className={p.active ? "" : "opacity-60"}>
                      <td>
                        <div className="font-semibold text-heading">{p.title}</div>
                        <div className="text-xs text-muted">
                          {p.invoicesCreated || 0} invoice{p.invoicesCreated === 1 ? "" : "s"} so far
                          {p.lastInvoice && (
                            <>
                              {" · "}
                              <Link href={`/invoices/${p.lastInvoice}`} className="text-brand hover:underline dark:text-[#8f9bff]">last invoice</Link>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-muted">{c ? c.company || c.name : "—"}</td>
                      <td className="whitespace-nowrap font-semibold text-heading">{formatMoney(total(p), p.currency)}</td>
                      <td className="whitespace-nowrap">{EVERY[p.interval]}</td>
                      <td className="whitespace-nowrap">{p.active ? formatDate(p.nextRunAt) : "Paused"}</td>
                      <td>
                        <StatusSelect url={`/api/recurring/${p._id}`} value={p.active ? "Active" : "Paused"} options={["Active", "Paused"]} field="active" />
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <RecurringRowActions plan={p} clients={clients} settings={formSettings} />
                          <DeleteButton small url={`/api/recurring/${p._id}`} confirmText={`Delete "${p.title}"? Invoices already created stay.`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
