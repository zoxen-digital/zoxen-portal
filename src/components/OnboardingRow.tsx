"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Loader2, Rocket, XCircle } from "lucide-react";
import { Modal } from "./Modal";
import { Badge } from "./ui";
import { DeleteButton } from "./actions";
import { api } from "@/lib/client-api";
import { useDialogs } from "./Dialogs";
import { formatDate } from "@/lib/utils";
import type { ClientT, OnboardingT } from "@/lib/types";

type ClientOpt = { _id: string; name: string; company?: string; email?: string };

const isApproved = (s: string) => s === "Approved" || s === "Converted";

/**
 * View / approve / reject one submission.
 * `details` is the server-rendered answers (OnboardingDetails), passed in so this stays a small client component.
 */
export function OnboardingActions({
  item,
  clients,
  canDelete,
  details,
  autoOpen,
}: {
  item: OnboardingT;
  clients: ClientOpt[];
  canDelete: boolean;
  details: React.ReactNode;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const linked = item.client as ClientT | string | null | undefined;
  const linkedId = typeof linked === "string" ? linked : linked?._id || "";
  // Best guess: the client this form was sent to, or one with the same email.
  const guess = linkedId || clients.find((c) => c.email && item.email && c.email.toLowerCase() === item.email.toLowerCase())?._id || "";
  const [client, setClient] = useState(guess);

  useEffect(() => {
    if (autoOpen) view();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  async function view() {
    setOpen(true);
    if (item.status === "New") {
      await api(`/api/onboarding/${item._id}`, "PATCH", { status: "Reviewed" }).catch(() => {});
      router.refresh();
    }
  }

  async function approve() {
    if (!client) return notify("Choose the client this form belongs to", "error");
    setBusy(true);
    try {
      const r = await api<{ clientId: string; projectId: string }>(`/api/onboarding/${item._id}/approve`, "POST", { client });
      notify("Approved. The project has started and the client was notified.");
      setOpen(false);
      router.push(`/projects/${r.projectId}`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!(await confirm({ title: "Reject this form?", message: "No project is created. You can still delete it later.", tone: "danger", confirmText: "Reject" }))) return;
    try {
      await api(`/api/onboarding/${item._id}`, "PATCH", { status: "Rejected" });
      notify("Form rejected");
      setOpen(false);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const approveBox = (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <div className="mb-2 text-sm font-bold text-heading">Approve and tag to client</div>
      <p className="mb-3 text-xs text-muted">The form is saved under the client, a project starts (stage Approved, website checklist and add-ons as tasks) and the client is notified.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className="input" value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">Choose client...</option>
          <option value="new">+ Create a new client from this form</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
              {c.company ? ` — ${c.company}` : ""}
            </option>
          ))}
        </select>
        <button onClick={approve} disabled={busy || !client} className="btn btn-primary shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
        </button>
      </div>
      {linkedId && client === linkedId && <p className="mt-2 text-xs text-emerald-600">Sent from this client&apos;s personal link.</p>}
    </div>
  );

  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={view} className="btn btn-ghost btn-sm px-2" title="View answers">
        <Eye className="h-4 w-4" />
      </button>
      {isApproved(item.status) ? (
        item.project ? (
          <Link href={`/projects/${item.project}`} className="btn btn-outline btn-sm">
            <Rocket className="h-3.5 w-3.5" /> Project
          </Link>
        ) : linkedId ? (
          <Link href={`/clients/${linkedId}`} className="btn btn-outline btn-sm">Open client</Link>
        ) : null
      ) : item.status !== "Rejected" ? (
        <button onClick={view} className="btn btn-primary btn-sm">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </button>
      ) : null}
      {canDelete && <DeleteButton small url={`/api/onboarding/${item._id}`} confirmText="Delete this submission?" />}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={item.company || item.name}
        subtitle={`${item.name} · submitted ${formatDate(item.createdAt)}`}
        size="xl"
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Badge status={isApproved(item.status) ? "Approved" : item.status} dot />
          {item.approvedBy && <span className="text-xs text-muted">by {item.approvedBy} on {formatDate(item.approvedAt)}</span>}
          {!isApproved(item.status) && item.status !== "Rejected" && (
            <button onClick={reject} className="btn btn-ghost btn-sm ml-auto text-red-500">
              <XCircle className="h-4 w-4" /> Reject
            </button>
          )}
        </div>
        {!isApproved(item.status) && item.status !== "Rejected" && <div className="mb-6">{approveBox}</div>}
        {details}
      </Modal>
    </div>
  );
}
