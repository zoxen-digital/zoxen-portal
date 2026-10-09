"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";

type Staff = { _id: string; name: string; email: string; role: string; title?: string; status: string };

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="input pr-10"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        minLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "At least 8 characters"}
      />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Create a super admin or team member with email + password set by the owner. */
export function NewStaffButton() {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const empty = { name: "", email: "", password: "", role: "super_admin", title: "" };
  const [f, setF] = useState(empty);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/agent/users", "POST", f);
      notify(`${f.name} can now sign in with ${f.email}`);
      setOpen(false);
      setF(empty);
      router.refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="h-4 w-4" /> Add admin / team member
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New account" subtitle="You set the email and password. Share them privately; they can sign in right away.">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name *">
            <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Role *">
            <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="super_admin">Super Admin (full access)</option>
              <option value="team_admin">Team Admin (assigned work only)</option>
            </select>
          </Field>
          <Field label="Email (login) *">
            <input className="input" type="email" required autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Password *">
            <PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} />
          </Field>
          <Field label="Job title" className="sm:col-span-2">
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Operations Manager" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Row actions: edit, new password, ban / unban, force logout, delete. */
export function StaffActions({ user }: { user: Staff }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState(false);
  const [pw, setPw] = useState(false);
  const [f, setF] = useState({ name: user.name, role: user.role, title: user.title || "" });
  const [password, setPassword] = useState("");

  async function call(key: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(key);
    try {
      await fn();
      notify(msg);
      router.refresh();
      return true;
    } catch (e) {
      notify((e as Error).message, "error");
      return false;
    } finally {
      setBusy("");
    }
  }

  const banned = user.status === "disabled";

  return (
    <div className="flex justify-end gap-1">
      <button onClick={() => setEdit(true)} className="btn btn-ghost btn-sm px-2" title="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={() => setPw(true)} className="btn btn-ghost btn-sm px-2" title="Set a new password">
        <KeyRound className="h-4 w-4" />
      </button>
      <button
        onClick={async () => {
          if (await confirm({ title: `Sign ${user.name} out everywhere?`, message: "Every device they are signed in on is logged out now. They can sign in again with their password.", confirmText: "Force logout" }))
            call("out", () => api(`/api/agent/users/${user._id}/logout`, "POST"), `${user.name} was signed out everywhere`);
        }}
        disabled={!!busy}
        className="btn btn-ghost btn-sm px-2"
        title="Force logout"
      >
        {busy === "out" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      </button>
      <button
        onClick={async () => {
          if (banned || (await confirm({ title: `Ban ${user.name}?`, message: "They are signed out and cannot sign in until you unban them.", confirmText: "Ban", tone: "danger" })))
            call("ban", () => api(`/api/agent/users/${user._id}`, "PUT", { status: banned ? "active" : "disabled" }), banned ? `${user.name} unbanned` : `${user.name} banned`);
        }}
        disabled={!!busy}
        className="btn btn-ghost btn-sm px-2"
        title={banned ? "Unban" : "Ban"}
      >
        {banned ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Ban className="h-4 w-4 text-amber-500" />}
      </button>
      <button
        onClick={async () => {
          if (await confirm({ title: `Delete ${user.name}?`, message: "Their account is removed. It stays in the Recycle Bin for 30 days.", confirmText: "Delete", tone: "danger" }))
            call("del", () => api(`/api/agent/users/${user._id}`, "DELETE"), `${user.name} deleted`);
        }}
        disabled={!!busy}
        className="btn btn-ghost btn-sm px-2 hover:text-red-500"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Modal open={edit} onClose={() => setEdit(false)} title={`Edit ${user.name}`} subtitle={user.email}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call("edit", () => api(`/api/agent/users/${user._id}`, "PUT", f), "Account updated")) setEdit(false);
          }}
          className="space-y-4"
        >
          <Field label="Name">
            <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="super_admin">Super Admin</option>
              <option value="team_admin">Team Admin</option>
            </select>
            {f.role !== user.role && <p className="mt-1 text-xs text-amber-600">Changing the role signs them out.</p>}
          </Field>
          <Field label="Job title">
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEdit(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={!!busy}>Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={pw} onClose={() => setPw(false)} title={`New password for ${user.name}`} subtitle="They are signed out and must use the new password.">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call("pw", () => api(`/api/agent/users/${user._id}`, "PUT", { password }), "Password changed")) {
              setPw(false);
              setPassword("");
            }
          }}
          className="space-y-4"
        >
          <PasswordInput value={password} onChange={setPassword} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPw(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={!!busy || password.length < 8}>Set password</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
