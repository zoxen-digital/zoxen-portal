"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { api } from "@/lib/client-api";
import { PROJECT_STAGES, SERVICES } from "@/lib/constants";
import { cn, toInputDate } from "@/lib/utils";
import type { ClientT, ProjectT } from "@/lib/types";
import type { ClientOption } from "./QueryForm";

export type TeamOption = { _id: string; name: string; title?: string };

const EMPTY = {
  client: "",
  title: "",
  service: SERVICES[0]!,
  stage: "Approved",
  startDate: "",
  dueDate: "",
  revisionLimit: "2",
  domain: "",
  description: "",
  team: [] as string[],
};

export function ProjectFormModal({
  open,
  onClose,
  initial,
  clients,
  team,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ProjectT;
  clients: ClientOption[];
  team: TeamOption[];
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
      const c = initial.client as ClientT | string | null;
      setForm({
        client: typeof c === "string" ? c : c?._id || "",
        title: initial.title,
        service: initial.service || "Other",
        stage: initial.stage,
        startDate: toInputDate(initial.startDate),
        dueDate: toInputDate(initial.dueDate),
        revisionLimit: String(initial.revisionLimit ?? 2),
        domain: initial.domain || "",
        description: initial.description || "",
        team: initial.team.map((t) => (typeof t === "string" ? t : t._id)),
      });
    } else {
      setForm({ ...EMPTY, client: clientId || "", startDate: toInputDate(new Date()) });
    }
  }, [open, initial, clientId]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleTeam = (id: string) =>
    setForm((f) => ({ ...f, team: f.team.includes(id) ? f.team.filter((t) => t !== id) : [...f.team, id] }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      if (initial) {
        await api(`/api/projects/${initial._id}`, "PUT", form);
        onClose();
        router.refresh();
      } else {
        const p = await api<ProjectT>("/api/projects", "POST", form);
        onClose();
        router.push(`/projects/${p._id}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit project" : "New project"} subtitle="Who it is for, who owns it and when it is due." size="lg">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Client *" className="sm:col-span-2">
          <select className="input" value={form.client} onChange={set("client")} required disabled={!!clientId && !initial}>
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project title *" className="sm:col-span-2">
          <input className="input" value={form.title} onChange={set("title")} required placeholder="e.g. 6-page business website" />
        </Field>
        <Field label="Service">
          <select className="input" value={form.service} onChange={set("service")}>
            {SERVICES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Stage">
          <select className="input" value={form.stage} onChange={set("stage")}>
            {PROJECT_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input className="input" type="date" value={form.startDate} onChange={set("startDate")} />
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={form.dueDate} onChange={set("dueDate")} />
        </Field>
        <Field label="Included revision rounds">
          <input className="input" type="number" min="0" value={form.revisionLimit} onChange={set("revisionLimit")} />
          <p className="mt-1 text-xs text-muted">0 = unlimited. Extra rounds are flagged to you and the client.</p>
        </Field>
        <Field label="Domain">
          <input className="input" value={form.domain} onChange={set("domain")} placeholder="clientsite.com" />
        </Field>
        <div className="sm:col-span-2">
          <span className="label">Assigned team</span>
          {team.length === 0 ? (
            <p className="text-sm text-muted">No team accounts yet. Add them under Team &amp; Portal Users.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {team.map((t) => {
                const on = form.team.includes(t._id);
                return (
                  <button
                    type="button"
                    key={t._id}
                    onClick={() => toggleTeam(t._id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      on ? "border-brand bg-brand/10 text-brand dark:text-[#8f9bff]" : "border-line text-muted hover:bg-surface-2"
                    )}
                  >
                    {t.name}
                    {t.title ? <span className="opacity-70"> · {t.title}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Field label="Scope / requirement" className="sm:col-span-2">
          <textarea className="input" rows={3} value={form.description} onChange={set("description")} placeholder="Pages, features, deliverables. The client sees this." />
        </Field>
        {err && <p className="text-sm text-red-500 sm:col-span-2">{err}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button disabled={saving} className="btn btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {initial ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function NewProjectButton(props: { clients: ClientOption[]; team: TeamOption[]; clientId?: string; label?: string; outline?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={props.outline ? "btn btn-outline" : "btn btn-primary"}>
        <Plus className="h-4 w-4" /> {props.label || "New Project"}
      </button>
      <ProjectFormModal open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}

export function EditProjectButton({ project, clients, team }: { project: ProjectT; clients: ClientOption[]; team: TeamOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-outline">
        <Pencil className="h-4 w-4" /> Edit
      </button>
      <ProjectFormModal open={open} onClose={() => setOpen(false)} initial={project} clients={clients} team={team} />
    </>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="h-full rounded-full bg-brand-gradient transition-[width]" style={{ width: `${v}%` }} />
    </div>
  );
}
