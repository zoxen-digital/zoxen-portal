"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Loader2, UserPlus } from "lucide-react";
import { Modal } from "./Modal";
import { Badge, InfoRow } from "./ui";
import { DeleteButton, StatusSelect } from "./actions";
import { api } from "@/lib/client-api";
import { useDialogs } from "./Dialogs";
import { ONBOARDING_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { OnboardingT } from "@/lib/types";

export function OnboardingActions({ item }: { item: OnboardingT }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function convert() {
    setBusy(true);
    try {
      const { clientId } = await api<{ clientId: string }>(`/api/onboarding/${item._id}/convert`, "POST");
      notify("Converted to client");
      router.push(`/clients/${clientId}`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
      setBusy(false);
    }
  }

  async function view() {
    setOpen(true);
    if (item.status === "New") {
      await api(`/api/onboarding/${item._id}`, "PATCH", { status: "Reviewed" }).catch(() => {});
      router.refresh();
    }
  }

  const extra = Object.entries(item.data || {}).filter(
    ([k]) => !["name", "email", "phone", "company", "website", "services", "budget", "message"].includes(k)
  );

  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={view} className="btn btn-ghost btn-sm px-2" title="View">
        <Eye className="h-4 w-4" />
      </button>
      {item.client ? (
        <Link href={`/clients/${item.client}`} className="btn btn-outline btn-sm">Open client</Link>
      ) : (
        <button onClick={convert} disabled={busy} className="btn btn-primary btn-sm">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Convert
        </button>
      )}
      <DeleteButton small url={`/api/onboarding/${item._id}`} confirmText="Delete this submission?" />

      <Modal open={open} onClose={() => setOpen(false)} title={item.name} subtitle={`Submitted ${formatDate(item.createdAt)}`} size="lg">
        <div className="mb-4 flex items-center gap-3">
          <Badge status={item.status} />
          <StatusSelect url={`/api/onboarding/${item._id}`} value={item.status} options={ONBOARDING_STATUSES} method="PATCH" />
        </div>
        <div className="divide-y divide-line">
          <InfoRow label="Email" value={item.email} />
          <InfoRow label="Phone" value={item.phone} />
          <InfoRow label="Company" value={item.company} />
          <InfoRow label="Website" value={item.website} />
          <InfoRow label="Services" value={item.services?.join(", ")} />
          <InfoRow label="Budget" value={item.budget} />
          {extra.map(([k, v]) => (
            <InfoRow key={k} label={k} value={typeof v === "object" ? JSON.stringify(v) : String(v)} />
          ))}
        </div>
        {item.message && (
          <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">
            <div className="mb-1 text-xs font-semibold text-muted">Message / requirements</div>
            <p className="whitespace-pre-wrap text-fg">{item.message}</p>
          </div>
        )}
        {!item.client && (
          <div className="mt-5 flex justify-end">
            <button onClick={convert} disabled={busy} className="btn btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Convert to client
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
