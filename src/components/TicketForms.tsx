"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from "@/lib/constants";
import { toInputDate } from "@/lib/utils";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { AttachmentPicker } from "./FileUpload";
import { useDialogs } from "./Dialogs";
import type { AttachmentT, TicketT } from "@/lib/types";

type Opt = { _id: string; name: string };
type ProjectOpt = { _id: string; title: string; client: string };

/** Staff: open a ticket for a client (reported on a call, WhatsApp, etc.). */
export function NewTicketButton({
  clients,
  projects,
  team,
  isOwner,
  uploads,
}: {
  clients: Opt[];
  projects: ProjectOpt[];
  team: Opt[];
  isOwner: boolean;
  uploads: boolean;
}) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const empty = { client: "", project: "", type: "Bug", priority: "Medium", title: "", description: "", assignee: "" };
  const [f, setF] = useState(empty);
  const [files, setFiles] = useState<AttachmentT[]>([]);
  const clientProjects = useMemo(() => projects.filter((p) => p.client === f.client), [projects, f.client]);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value, ...(k === "client" ? { project: "" } : {}) }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api<TicketT>("/api/tickets", "POST", { ...f, attachments: files });
      setOpen(false);
      setF(empty);
      setFiles([]);
      notify(`Ticket ${t.number} created`);
      router.push(`/tickets/${t._id}`);
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="h-4 w-4" /> New ticket
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New support ticket" subtitle="The client is notified and can follow it in their portal." size="lg">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Client *">
            <select className="input" required value={f.client} onChange={set("client")}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label={isOwner ? "Project" : "Project *"}>
            <select className="input" value={f.project} onChange={set("project")} required={!isOwner} disabled={!f.client}>
              <option value="">{isOwner ? "No project" : "Select a project"}</option>
              {clientProjects.map((p) => (
                <option key={p._id} value={p._id}>{p.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select className="input" value={f.type} onChange={set("type")}>
              {TICKET_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={f.priority} onChange={set("priority")}>
              {TICKET_PRIORITIES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          {isOwner && (
            <Field label="Assign to" className="sm:col-span-2">
              <select className="input" value={f.assignee} onChange={set("assignee")}>
                <option value="">Project team (automatic)</option>
                {team.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Title *" className="sm:col-span-2">
            <input className="input" required value={f.title} onChange={set("title")} placeholder="e.g. Contact form not sending emails" />
          </Field>
          <Field label="Details" className="sm:col-span-2">
            <textarea className="input" rows={4} value={f.description} onChange={set("description")} placeholder="What happens, which page, steps to reproduce..." />
          </Field>
          {uploads && (
            <div className="sm:col-span-2">
              <AttachmentPicker value={files} onChange={setFiles} label="Attach screenshots / files" />
            </div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create ticket
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Staff controls on the ticket page: status, priority, type, assignee, due date. */
export function TicketControls({ ticket, team, isOwner }: { ticket: TicketT; team: Opt[]; isOwner: boolean }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  const assignee = typeof ticket.assignee === "string" ? ticket.assignee : ticket.assignee?._id || "";

  async function save(patch: Record<string, unknown>, msg = "Ticket updated") {
    setBusy(true);
    try {
      await api(`/api/tickets/${ticket._id}`, "PUT", patch);
      notify(msg);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-bold text-heading">Ticket controls</h2>
      <Field label="Status">
        <select className="input" value={ticket.status} disabled={busy} onChange={(e) => save({ status: e.target.value }, `Status: ${e.target.value}`)}>
          {TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <select className="input" value={ticket.priority} disabled={busy} onChange={(e) => save({ priority: e.target.value })}>
            {TICKET_PRIORITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className="input" value={ticket.type} disabled={busy} onChange={(e) => save({ type: e.target.value })}>
            {TICKET_TYPES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Assigned to">
        <select className="input" value={assignee} disabled={busy || !isOwner} onChange={(e) => save({ assignee: e.target.value || null }, "Assignee updated")}>
          <option value="">Unassigned</option>
          {team.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Due date">
        <input className="input" type="date" disabled={busy} defaultValue={toInputDate(ticket.dueDate)} onBlur={(e) => e.target.value !== toInputDate(ticket.dueDate) && save({ dueDate: e.target.value || null }, "Due date updated")} />
      </Field>
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
    </div>
  );
}

/** Client: open a new support request. */
export function PortalNewTicketButton({ projects, uploads }: { projects: { _id: string; title: string }[]; uploads: boolean }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const empty = { project: projects[0]?._id || "", type: "Bug", priority: "Medium", title: "", description: "" };
  const [f, setF] = useState(empty);
  const [files, setFiles] = useState<AttachmentT[]>([]);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api<TicketT>("/api/portal/tickets", "POST", { ...f, attachments: files });
      setOpen(false);
      setF(empty);
      setFiles([]);
      notify(`Request ${t.number} sent. Our team has been notified.`);
      router.push(`/portal/tickets/${t._id}`);
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="h-4 w-4" /> New support request
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New support request" subtitle="Tell us what you need. We will reply here and notify you." size="lg">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {projects.length > 0 && (
            <Field label="Project" className="sm:col-span-2">
              <select className="input" value={f.project} onChange={set("project")}>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                <option value="">Other / general</option>
              </select>
            </Field>
          )}
          <Field label="What kind of request?">
            <select className="input" value={f.type} onChange={set("type")}>
              {TICKET_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="How urgent?">
            <select className="input" value={f.priority} onChange={set("priority")}>
              {TICKET_PRIORITIES.filter((p) => p !== "Urgent").map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Short title *" className="sm:col-span-2">
            <input className="input" required value={f.title} onChange={set("title")} placeholder="e.g. Update prices on the services page" />
          </Field>
          <Field label="Details *" className="sm:col-span-2">
            <textarea className="input" rows={5} required minLength={5} value={f.description} onChange={set("description")} placeholder="Which page, what should change, any links or examples..." />
          </Field>
          {uploads && (
            <div className="sm:col-span-2">
              <AttachmentPicker value={files} onChange={setFiles} label="Attach screenshots / files" />
            </div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send request
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Client: close a resolved ticket or reopen it. */
export function PortalTicketActions({ ticket }: { ticket: TicketT }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  const done = ["Resolved", "Closed"].includes(ticket.status);

  async function act(action: "close" | "reopen") {
    setBusy(true);
    try {
      await api(`/api/portal/tickets/${ticket._id}`, "PUT", { action });
      notify(action === "close" ? "Thanks! Ticket closed." : "Ticket reopened. The team has been notified.");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (ticket.status === "Closed") {
    return (
      <button onClick={() => act("reopen")} disabled={busy} className="btn btn-outline">
        <RotateCcw className="h-4 w-4" /> Reopen
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      {done && (
        <button onClick={() => act("reopen")} disabled={busy} className="btn btn-outline">
          <RotateCcw className="h-4 w-4" /> Still a problem
        </button>
      )}
      <button onClick={() => act("close")} disabled={busy} className="btn bg-emerald-500 text-white hover:bg-emerald-600">
        <CheckCircle2 className="h-4 w-4" /> {done ? "Confirm and close" : "Close request"}
      </button>
    </div>
  );
}
