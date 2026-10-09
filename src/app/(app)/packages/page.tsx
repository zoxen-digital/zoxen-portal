import { Package as PackageIcon } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Package } from "@/models/Package";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { SectionTabs } from "@/components/DealTabs";
import { DeleteButton, StatusSelect } from "@/components/actions";
import { EditPackageButton, NewPackageButton } from "@/components/PackageForms";
import { itemsTotal } from "@/lib/invoice-calc";
import { formatMoney, serialize } from "@/lib/utils";
import type { PackageT } from "@/lib/types";

export const metadata = { title: "Packages" };

export default async function PackagesPage() {
  await pageUser(ADMIN);
  await dbConnect();
  const [docs, settings] = await Promise.all([Package.find().sort({ active: -1, name: 1 }).lean(), getSettings()]);
  const packages = serialize<PackageT[]>(docs);

  return (
    <div>
      <SectionTabs group="billing" current="/packages" />
      <PageHeader title="Packages" subtitle="Ready-made services. Start one for a client in one click: quote, or project + invoice with the checklist and timeline set.">
        <NewPackageButton currency={settings.defaultCurrency} />
      </PageHeader>
      {packages.length === 0 ? (
        <div className="card">
          <EmptyState icon={PackageIcon} title="No packages yet" text='Create your common offers, e.g. "5-page website" or "SEO monthly".' />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((p) => (
            <div key={p._id} className={`card flex flex-col p-5 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-heading">{p.name}</h2>
                  <p className="text-xs text-muted">{p.service}</p>
                </div>
                {!p.active && <Badge status="Paused" />}
              </div>
              <div className="mt-3 text-2xl font-bold text-heading">{formatMoney(itemsTotal(p.items), p.currency)}</div>
              {p.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{p.description}</p>}
              <ul className="mt-3 space-y-1 text-xs text-muted">
                <li>{p.durationDays} days delivery</li>
                <li>{p.revisionLimit ? `${p.revisionLimit} revision round${p.revisionLimit === 1 ? "" : "s"}` : "Unlimited revisions"}</li>
                <li>{p.checklist.length} checklist tasks · {p.items.length} priced item{p.items.length === 1 ? "" : "s"}</li>
              </ul>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <StatusSelect url={`/api/packages/${p._id}`} value={p.active ? "Active" : "Paused"} options={["Active", "Paused"]} field="active" />
                <div className="flex gap-1">
                  <EditPackageButton pkg={p} currency={settings.defaultCurrency} />
                  <DeleteButton small url={`/api/packages/${p._id}`} confirmText={`Delete package "${p.name}"? Quotes and projects already created stay.`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
