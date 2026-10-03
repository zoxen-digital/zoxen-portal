import { CheckCircle2 } from "lucide-react";
import { Logo } from "./Logo";
import { Badge } from "./ui";
import { formatDate } from "@/lib/utils";
import type { ClientT, ContractT, SettingsT } from "@/lib/types";

/** The agreement as the client reads and signs it. Also used for the PDF. */
export function ContractDocument({ contract, settings, client }: { contract: ContractT; settings: SettingsT; client: ClientT | null }) {
  return (
    <div data-invoice-doc className="paper print-plain mx-auto w-full max-w-[860px] rounded-2xl border border-line bg-surface p-5 text-fg shadow-xl shadow-brand/5 sm:p-10">
      <div className="flex flex-col-reverse justify-between gap-6 border-b border-line pb-6 sm:flex-row sm:items-start">
        <div>
          <Logo />
          <div className="mt-4 text-lg font-bold text-heading">{settings.companyName}</div>
          {settings.address && <div className="text-xs text-muted">{settings.address}</div>}
        </div>
        <div className="sm:text-right">
          <div className="text-3xl font-extrabold tracking-tight text-heading">AGREEMENT</div>
          <div className="mt-1 font-semibold text-muted">#{contract.number}</div>
          <div className="mt-3">
            <Badge status={contract.status} dot className="px-3 py-1 text-sm" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-4 border-b border-line py-5 text-sm">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-muted">Client</div>
          <div className="font-semibold text-heading">{client?.name}</div>
          {client?.company && <div className="text-muted">{client.company}</div>}
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">Date</div>
          <div className="font-semibold text-heading">{formatDate(contract.sentAt || contract.createdAt)}</div>
        </div>
      </div>
      <h1 className="mt-6 text-xl font-bold text-heading">{contract.title}</h1>
      <div className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{contract.body}</div>

      <div className="mt-10 grid gap-8 border-t border-line pt-6 sm:grid-cols-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-muted">For {settings.companyName}</div>
          <div className="mt-6 border-b border-line pb-1 font-serif text-xl italic text-heading">{contract.createdBy || settings.companyName}</div>
          <div className="mt-1 text-xs text-muted">Issued {formatDate(contract.sentAt || contract.createdAt)}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-muted">Client signature</div>
          {contract.status === "Signed" && contract.signedAt ? (
            <>
              <div className="mt-6 border-b border-line pb-1 font-serif text-2xl italic text-heading">{contract.signedName}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Signed electronically {new Date(contract.signedAt).toUTCString()}
              </div>
              {contract.signedIp && <div className="text-xs text-muted">IP {contract.signedIp}</div>}
            </>
          ) : (
            <div className="mt-6 border-b border-dashed border-line pb-6 text-xs text-muted">Not signed yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
