"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { api } from "@/lib/client-api";
import { CLIENT_SOURCES, CLIENT_STATUSES } from "@/lib/constants";
import type { ClientT } from "@/lib/types";

const EMPTY = { name: "", company: "", email: "", phone: "", website: "", address: "", source: "Manual", status: "Active", notes: "" };

export function ClientFormModal({
  open,
  onClose,
  initial,
  redirectOnCreate = true,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ClientT;
  redirectOnCreate?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setErr("");
      setForm(initial ? { ...EMPTY, ...stripNulls(initial) } : EMPTY);
    }
  }, [open, initial]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      if (initial) {
        await api(`/api/clients/${initial._id}`, "PUT", form);
        onClose();
        router.refresh();
      } else {
        const created = await api<ClientT>("/api/clients", "POST", form);
        onClose();
        if (redirectOnCreate) router.push(`/clients/${created._id}`);
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit client" : "New client"} subtitle="Basic contact and business details." size="lg">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name *">
          <input className="input" value={form.name} onChange={set("name")} required placeholder="e.g. Ahmed Khan" autoFocus />
        </Field>
        <Field label="Company / Business">
          <input className="input" value={form.company} onChange={set("company")} placeholder="e.g. Khan Tech Solutions" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="name@company.com" />
        </Field>
        <Field label="Phone / WhatsApp">
          <input className="input" value={form.phone} onChange={set("phone")} placeholder="+92 300 1234567" />
        </Field>
        <Field label="Website">
          <input className="input" value={form.website} onChange={set("website")} placeholder="company.com" />
        </Field>
        <Field label="Address">
          <input className="input" value={form.address} onChange={set("address")} placeholder="City, Country" />
        </Field>
        <Field label="Lead source">
          <select className="input" value={form.source} onChange={set("source")}>
            {CLIENT_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={set("status")}>
            {CLIENT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} placeholder="Anything the team should know about this client" />
        </Field>
        {err && <p className="text-sm text-red-500 sm:col-span-2">{err}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button disabled={saving} className="btn btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {initial ? "Save changes" : "Create client"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function stripNulls<T extends object>(o: T) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<typeof EMPTY>;
}

export function NewClientButton({ autoOpen = false, label = "New Client" }: { autoOpen?: boolean; label?: string }) {
  const [open, setOpen] = useState(autoOpen);
  const router = useRouter();
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="h-4 w-4" /> {label}
      </button>
      <ClientFormModal
        open={open}
        onClose={() => {
          setOpen(false);
          if (autoOpen) router.replace("/clients");
        }}
      />
    </>
  );
}

export function EditClientButton({ client }: { client: ClientT }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-outline">
        <Pencil className="h-4 w-4" /> Edit
      </button>
      <ClientFormModal open={open} onClose={() => setOpen(false)} initial={client} />
    </>
  );
}
