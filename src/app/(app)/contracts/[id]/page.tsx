import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/mailer";
import { validId } from "@/lib/api";
import { Contract } from "@/models/Contract";
import { ContractDocument } from "@/components/ContractDocument";
import { ContractActions } from "@/components/ContractForms";
import { LocalTime } from "@/components/LocalTime";
import { serialize } from "@/lib/utils";
import type { ClientT, ContractT } from "@/lib/types";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  await pageUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) notFound();
  await dbConnect();
  const [doc, settings] = await Promise.all([Contract.findById(id).populate("client", "name company email").lean(), getSettings()]);
  if (!doc) notFound();
  const contract = serialize<ContractT>(doc);

  return (
    <div className="space-y-6">
      <Link href="/contracts" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to contracts
      </Link>
      <div className="card space-y-3 p-5">
        <div className="text-sm text-muted">
          {contract.status === "Draft" && "Draft: only you can see it."}
          {contract.status === "Sent" && (
            <>
              Waiting for signature · sent {contract.sentAt && <LocalTime iso={contract.sentAt} />}
              {contract.viewedAt && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                  <Eye className="h-3.5 w-3.5" /> Viewed <LocalTime iso={contract.viewedAt} />
                </span>
              )}
            </>
          )}
          {contract.status === "Signed" && contract.signedAt && (
            <span className="font-semibold text-emerald-600">
              Signed by {contract.signedName} · <LocalTime iso={contract.signedAt} />
            </span>
          )}
          {contract.status === "Void" && "Void: the signing link no longer works."}
        </div>
        <ContractActions contract={contract} link={appUrl(`/contract/${contract.publicId}`)} />
      </div>
      <ContractDocument contract={contract} settings={settings} client={contract.client as ClientT | null} />
    </div>
  );
}
