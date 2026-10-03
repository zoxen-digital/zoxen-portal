import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { Contract } from "@/models/Contract";
import { ContractDocument } from "@/components/ContractDocument";
import { SignContractBox } from "@/components/ContractForms";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { serialize } from "@/lib/utils";
import type { ClientT, ContractT } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ publicId: string }> };

async function load(publicId: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(publicId)) return null;
  await dbConnect();
  return Contract.findOne({ publicId, status: { $in: ["Sent", "Signed"] } }).populate("client", "name company").lean();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const doc = (await load(publicId)) as { number?: string } | null;
  const settings = await getSettings();
  return { title: { absolute: doc ? `Agreement ${doc.number} | ${settings.companyName}` : "Agreement not found" }, robots: { index: false, follow: false } };
}

export default async function PublicContractPage({ params }: Props) {
  const { publicId } = await params;
  const doc = await load(publicId);
  if (!doc) notFound();
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if ((!session || session.role === "client") && !(doc as { viewedAt?: Date }).viewedAt) {
    await Contract.updateOne({ publicId }, { $set: { viewedAt: new Date() } });
  }
  const contract = serialize<ContractT>(doc);
  const settings = await getSettings();

  return (
    <main className="paper min-h-screen bg-bg px-3 py-6 sm:px-6 sm:py-10">
      <div className="no-print mx-auto mb-4 flex max-w-[860px] justify-end">
        <DownloadPdfButton fileName={`Agreement-${contract.number}`} />
      </div>
      <ContractDocument contract={contract} settings={settings} client={contract.client as ClientT | null} />
      {contract.status === "Sent" ? (
        <SignContractBox publicId={contract.publicId} />
      ) : (
        <div className="no-print mx-auto mt-6 flex max-w-[860px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> Signed. Thank you! Keep a copy with Download PDF.
        </div>
      )}
    </main>
  );
}
