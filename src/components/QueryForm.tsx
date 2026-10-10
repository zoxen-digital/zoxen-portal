"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { api } from "@/lib/client-api";
import { QUERY_PRIORITIES, QUERY_STATUSES, SERVICES } from "@/lib/constants";
import { toInputDate } from "@/lib/utils";
import type { QueryT } from "@/lib/types";

export type ClientOption = { _id: string; name: string; company?: string };

const EMPTY = {
  client: "",
  title: "",
  service: SERVICES[0]!,
  description: "",
  status: "Pending",
  priority: "Medium",
  assignedTo: "",
  amount: "",
  dueDate: "",
  notes: "",
};

export function QueryFormModal({
  open,
  onClose,
  initial,
  clients,
  team,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  initial?: QueryT;
  clients: ClientOption[];
  team: string[];
  clientId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    if (initial) {
      const c = initial.client;
      setForm({
        client: typeof c === "string" ? c : c?._id || "",
        title: initial.title || "",
        service: initial.service || "Other",
        description: initial.description || "",
        status: initial.status || "Pending",
        priority: initial.priority || "Medium",
        assignedTo: initial.assignedTo || "",
        amount: initial.amount ? String(initial.amount) : "",
        dueDate: toInputDate(initial.dueDate),
        notes: initial.notes || "",
      });
    } else {
      setForm({ ...EMPTY, client: clientId || "" });
    }
  }, [open, initial, clientId]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      if (initial) await api(`/api/queries/${initial._id}`, "PUT", form);
      else await api("/api/queries", "POST", form);
      onClose();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit query / project" : "New query / project"} subtitle="What the client needs, who owns it and when it is due." size="lg">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={initial?.lead?.name ? "Client (link once they become a client)" : "Client *"} className="sm:col-span-2">
          <select className="input" value={form.client} onChange={set("client")} required={!initial?.lead?.name} disabled={!!clientId && !initial}>
            <option value="">{initial?.lead?.name ? `No client yet (lead: ${initial.lead.name})` : "Select a client"}</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Query / Project title *" className="sm:col-span-2">
          <input className="input" value={form.title} onChange={set("title")} required placeholder="e.g. 6-page business website with SEO" />
        </Field>
        <Field label="Service">
          <select className="input" value={form.service} onChange={set("service")}>
            {SERVICES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={set("status")}>
            {QUERY_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Assigned to">
          <input className="input" list="team-list" value={form.assignedTo} onChange={set("assignedTo")} placeholder="Team member" />
          <datalist id="team-list">
            {team.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Priority">
          <select className="input" value={form.priority} onChange={set("priority")}>
            {QUERY_PRIORITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Estimated amount">
          <input className="input" type="number" min="0" step="any" value={form.amount} onChange={set("amount")} placeholder="0" />
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={form.dueDate} onChange={set("dueDate")} />
        </Field>
        <Field label="Requirement details" className="sm:col-span-2">
          <textarea className="input" rows={3} value={form.description} onChange={set("description")} placeholder="Pages, features, references, deadlines..." />
        </Field>
        <Field label="Internal notes / blockers" className="sm:col-span-2">
          <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} placeholder="What is blocking this? What was promised?" />
        </Field>
        {err && <p className="text-sm text-red-500 sm:col-span-2">{err}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button disabled={saving} className="btn btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {initial ? "Save changes" : "Create query"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function NewQueryButton(props: { clients: ClientOption[]; team: string[]; clientId?: string; label?: string; outline?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={props.outline ? "btn btn-outline" : "btn btn-primary"}>
        <Plus className="h-4 w-4" /> {props.label || "New Query"}
      </button>
      <QueryFormModal open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}

export function EditQueryButton({ query, clients, team }: { query: QueryT; clients: ClientOption[]; team: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-ghost btn-sm px-2" title="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      <QueryFormModal open={open} onClose={() => setOpen(false)} initial={query} clients={clients} team={team} />
    </>
  );
}
