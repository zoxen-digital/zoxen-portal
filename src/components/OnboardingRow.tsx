"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Eye, Loader2, Rocket, Search, UserPlus, Users, XCircle } from "lucide-react";
import { Drawer } from "./Drawer";
import { Avatar, Badge } from "./ui";
import { DeleteButton } from "./actions";
import { api } from "@/lib/client-api";
import { useDialogs } from "./Dialogs";
import { cn, formatDate } from "@/lib/utils";
import type { ClientT, OnboardingT } from "@/lib/types";

type ClientOpt = { _id: string; name: string; company?: string; email?: string };

const isApproved = (s: string) => s === "Approved" || s === "Converted";

/**
 * View / approve / reject one submission in a right-hand panel.
 * `details` is the server-rendered answers (OnboardingDetails).
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
  // The client this form was sent to, or one with the same email.
  const match = linkedId || clients.find((c) => c.email && item.email && c.email.toLowerCase() === item.email.toLowerCase())?._id || "";

  const [mode, setMode] = useState<"existing" | "new">(match ? "existing" : "new");
  const [picked, setPicked] = useState(match);
  const [q, setQ] = useState("");
  const [nc, setNc] = useState({ name: item.name || "", company: item.company || "", email: item.email || "", phone: item.phone || "" });

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? clients.filter((c) => [c.name, c.company, c.email].some((v) => v?.toLowerCase().includes(t))) : clients;
    return list.slice(0, 50);
  }, [clients, q]);
  const pickedClient = clients.find((c) => c._id === picked);

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
    if (mode === "existing" && !picked) return notify("Search and select the client this form belongs to", "error");
    if (mode === "new" && !nc.name.trim()) return notify("Enter the new client's name", "error");
    setBusy(true);
    try {
      const body = mode === "existing" ? { client: picked } : { client: "new", newClient: nc };
      const r = await api<{ clientId: string; projectId: string }>(`/api/onboarding/${item._id}/approve`, "POST", body);
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

  const pending = !isApproved(item.status) && item.status !== "Rejected";

  const footer = pending ? (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-bold text-heading">Approve and tag to a client</div>
        <div className="flex rounded-xl border border-line bg-surface-2 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5", mode === "existing" ? "bg-surface text-heading shadow" : "text-muted")}
          >
            <Users className="h-3.5 w-3.5" /> Existing client
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5", mode === "new" ? "bg-surface text-heading shadow" : "text-muted")}
          >
            <UserPlus className="h-3.5 w-3.5" /> New client
          </button>
        </div>
      </div>

      {mode === "existing" ? (
        <div className="space-y-2">
          {pickedClient && (
            <div className="flex items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 px-3 py-2">
              <Avatar name={pickedClient.name} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-semibold text-heading">{pickedClient.name}</div>
                <div className="truncate text-xs text-muted">{[pickedClient.company, pickedClient.email].filter(Boolean).join(" · ")}</div>
              </div>
              {picked === linkedId && <span className="text-[11px] font-semibold text-emerald-600">From their link</span>}
              <Check className="h-4 w-4 text-brand" />
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${clients.length} clients by name, company or email`} />
          </div>
          <ul className="max-h-36 overflow-y-auto rounded-xl border border-line">
            {results.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted">
                No client found.{" "}
                <button type="button" onClick={() => setMode("new")} className="font-semibold text-brand hover:underline dark:text-[#8f9bff]">
                  Add a new client
                </button>
              </li>
            ) : (
              results.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => setPicked(c._id)}
                    className={cn("flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2", picked === c._id && "bg-brand/5")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-heading">{c.name}</span>
                      <span className="block truncate text-xs text-muted">{[c.company, c.email].filter(Boolean).join(" · ") || "—"}</span>
                    </span>
                    {picked === c._id && <Check className="h-4 w-4 shrink-0 text-brand" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Client name *" />
          <input className="input" value={nc.company} onChange={(e) => setNc({ ...nc, company: e.target.value })} placeholder="Company / business" />
          <input className="input" type="email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} placeholder="Email" />
          <input className="input" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} placeholder="Phone / WhatsApp" />
          <p className="text-xs text-muted sm:col-span-2">Filled from the form. Edit if needed; the client is created when you approve.</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button onClick={reject} className="btn btn-ghost text-red-500">
          <XCircle className="h-4 w-4" /> Reject
        </button>
        <button onClick={approve} disabled={busy || (mode === "existing" ? !picked : !nc.name.trim())} className="btn btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {mode === "new" ? "Create client & approve" : "Approve"}
        </button>
      </div>
    </div>
  ) : isApproved(item.status) && item.project ? (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">Approved{item.approvedBy ? ` by ${item.approvedBy}` : ""}.</span>
      <Link href={`/projects/${item.project}`} className="btn btn-primary">
        <Rocket className="h-4 w-4" /> Open project
      </Link>
    </div>
  ) : undefined;

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
          <Link href={`/clients/${linkedId}`} className="btn btn-outline btn-sm">
            Open client
          </Link>
        ) : null
      ) : item.status !== "Rejected" ? (
        <button onClick={view} className="btn btn-primary btn-sm">
          <CheckCircle2 className="h-3.5 w-3.5" /> Review & approve
        </button>
      ) : null}
      {canDelete && <DeleteButton small url={`/api/onboarding/${item._id}`} confirmText="Delete this submission?" />}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={item.company || item.name}
        subtitle={`${item.name} · submitted ${formatDate(item.createdAt)}`}
        badge={
          <>
            <Badge status={isApproved(item.status) ? "Approved" : item.status === "Approving" ? "Reviewed" : item.status} dot />
            {item.budget && <span className="text-xs font-semibold text-muted">{item.budget}</span>}
          </>
        }
        footer={footer}
      >
        {details}
      </Drawer>
    </div>
  );
}
