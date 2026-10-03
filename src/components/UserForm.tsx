"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, KeyRound, Loader2, Pencil, Plus, Send } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { CopyButton, DeleteButton } from "./actions";
import { useDialogs } from "./Dialogs";
import { api } from "@/lib/client-api";
import type { ClientT, RoleT, UserT } from "@/lib/types";
import type { ClientOption } from "./QueryForm";

type Invite = { link: string; emailed: boolean };

const ROLE_HELP: Record<RoleT, string> = {
  super_admin: "Full access, including invoices, revenue, reports, settings and users.",
  team_admin: "Sees only the projects and queries assigned to them. No invoices, revenue or settings.",
  client: "Client portal only: their own projects, approvals, revisions, documents and invoices.",
};

const EMPTY = { name: "", email: "", role: "team_admin" as RoleT, client: "", title: "", phone: "" };

export function UserFormModal({
  open,
  onClose,
  initial,
  clients,
  mailOn,
  presetClient,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  initial?: UserT;
  clients: ClientOption[];
  mailOn: boolean;
  /** Opens the form as "invite this client to the portal". */
  presetClient?: { _id: string; name: string; email?: string };
  onInvite?: (i: Invite) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    if (initial) {
      const c = initial.client as ClientT | string | null | undefined;
      setForm({
        name: initial.name,
        email: initial.email,
        role: initial.role,
        client: typeof c === "string" ? c : c?._id || "",
        title: initial.title || "",
        phone: initial.phone || "",
      });
    } else if (presetClient) {
      setForm({ ...EMPTY, role: "client", client: presetClient._id, name: presetClient.name, email: presetClient.email || "" });
    } else {
      setForm(EMPTY);
    }
  }, [open, initial, presetClient]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      if (initial) {
        const { email: _email, ...rest } = form;
        await api(`/api/users/${initial._id}`, "PUT", rest);
        onClose();
      } else {
        const res = await api<{ invite: Invite | null }>("/api/users", "POST", form);
        onClose();
        if (res.invite) onInvite?.(res.invite);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit user" : presetClient ? "Invite client to portal" : "Add user"}
      subtitle={initial ? initial.email : mailOn ? "They will get an email with a link to set their password." : "You will get a link to send them."}
      size="lg"
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *">
          <input className="input" value={form.name} onChange={set("name")} required autoFocus />
        </Field>
        <Field label="Email (login) *">
          <input className="input" type="email" value={form.email} onChange={set("email")} required disabled={!!initial} />
        </Field>
        {!presetClient && (
          <Field label="Role *" className="sm:col-span-2">
            <select className="input" value={form.role} onChange={set("role")}>
              <option value="team_admin">Team Admin</option>
              <option value="client">Client (portal)</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <p className="mt-1.5 text-xs text-muted">{ROLE_HELP[form.role]}</p>
          </Field>
        )}
        {form.role === "client" ? (
          <Field label="Client company *" className="sm:col-span-2">
            <select className="input" value={form.client} onChange={set("client")} required disabled={!!presetClient}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Job title">
            <input className="input" value={form.title} onChange={set("title")} placeholder="e.g. Web Developer" />
          </Field>
        )}
        <Field label="Phone / WhatsApp">
          <input className="input" value={form.phone} onChange={set("phone")} />
        </Field>
        {err && <p className="text-sm text-red-500 sm:col-span-2">{err}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? null : <Send className="h-4 w-4" />}
            {initial ? "Save changes" : "Create and invite"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function InviteResultModal({ invite, onClose }: { invite: Invite | null; onClose: () => void }) {
  return (
    <Modal open={!!invite} onClose={onClose} title={invite?.emailed ? "Invite sent" : "Share this link"} size="md">
      {invite && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {invite.emailed
              ? "We emailed them a link to set their password. You can also copy it and send it on WhatsApp."
              : "Email is not set up, so send this link yourself (WhatsApp or email). It works once and expires in 7 days."}
          </p>
          <input className="input font-mono text-xs" readOnly value={invite.link} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex justify-end gap-2">
            <a
              className="btn btn-outline"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`Here is your secure link to set your password: ${invite.link}`)}`}
            >
              WhatsApp
            </a>
            <CopyButton text={invite.link} />
            <button onClick={onClose} className="btn btn-primary">Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function NewUserButton({
  clients,
  mailOn,
  presetClient,
  label,
  outline,
}: {
  clients: ClientOption[];
  mailOn: boolean;
  presetClient?: { _id: string; name: string; email?: string };
  label?: string;
  outline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  return (
    <>
      <button onClick={() => setOpen(true)} className={outline ? "btn btn-outline" : "btn btn-primary"}>
        <Plus className="h-4 w-4" /> {label || "Add user"}
      </button>
      <UserFormModal open={open} onClose={() => setOpen(false)} clients={clients} mailOn={mailOn} presetClient={presetClient} onInvite={setInvite} />
      <InviteResultModal invite={invite} onClose={() => setInvite(null)} />
    </>
  );
}

export function UserActions({ user, clients, isMe, mailOn }: { user: UserT; clients: ClientOption[]; isMe: boolean; mailOn: boolean }) {
  const router = useRouter();
  const { confirm, notify } = useDialogs();
  const [edit, setEdit] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink() {
    setBusy(true);
    try {
      setInvite(await api<Invite>(`/api/users/${user._id}/invite`, "POST"));
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    const disabling = user.status !== "disabled";
    if (disabling) {
      const ok = await confirm({
        title: `Disable ${user.name}?`,
        message: "They will be signed out and cannot log in until you enable them again.",
        confirmText: "Disable",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api(`/api/users/${user._id}`, "PUT", { status: disabling ? "disabled" : "active" });
      notify(disabling ? "User disabled" : "User enabled");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      {user.status !== "disabled" && (
        <button onClick={sendLink} disabled={busy} className="btn btn-ghost btn-sm px-2" title={user.status === "active" ? "Password reset link" : "Resend invite"}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : user.status === "active" ? <KeyRound className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </button>
      )}
      <button onClick={() => setEdit(true)} className="btn btn-ghost btn-sm px-2" title="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      {!isMe && (
        <>
          <button onClick={toggle} disabled={busy} className="btn btn-ghost btn-sm px-2" title={user.status === "disabled" ? "Enable" : "Disable"}>
            {user.status === "disabled" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Ban className="h-4 w-4" />}
          </button>
          <DeleteButton small url={`/api/users/${user._id}`} confirmText={`Delete ${user.name}'s login? Their projects and history stay.`} />
        </>
      )}
      <UserFormModal open={edit} onClose={() => setEdit(false)} initial={user} clients={clients} mailOn={mailOn} />
      <InviteResultModal invite={invite} onClose={() => setInvite(null)} />
    </div>
  );
}
