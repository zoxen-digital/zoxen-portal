"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { api } from "@/lib/client-api";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";
import { PushToggle } from "./NotificationBell";

export function AccountForm({ name, email, phone }: { name: string; email: string; phone?: string }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [f, setF] = useState({ name, phone: phone || "", currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.newPassword && f.newPassword !== f.confirm) return notify("New passwords do not match", "error");
    setBusy(true);
    try {
      await api("/api/account", "PUT", { name: f.name, phone: f.phone, currentPassword: f.currentPassword, newPassword: f.newPassword || undefined });
      setF((x) => ({ ...x, currentPassword: "", newPassword: "", confirm: "" }));
      notify(f.newPassword ? "Account and password updated" : "Account updated");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={submit} className="card grid gap-4 p-6 sm:grid-cols-2 lg:col-span-2">
        <h2 className="font-bold text-heading sm:col-span-2">Profile</h2>
        <Field label="Name">
          <input className="input" value={f.name} onChange={set("name")} required />
        </Field>
        <Field label="Email (login)">
          <input className="input" value={email} disabled />
        </Field>
        <Field label="Phone / WhatsApp">
          <input className="input" value={f.phone} onChange={set("phone")} />
        </Field>
        <div />
        <h2 className="mt-2 font-bold text-heading sm:col-span-2">Change password</h2>
        <Field label="Current password">
          <input className="input" type="password" autoComplete="current-password" value={f.currentPassword} onChange={set("currentPassword")} />
        </Field>
        <div />
        <Field label="New password">
          <input className="input" type="password" autoComplete="new-password" minLength={8} value={f.newPassword} onChange={set("newPassword")} placeholder="At least 8 characters" />
        </Field>
        <Field label="Confirm new password">
          <input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </form>
      <div className="card h-fit p-6">
        <h2 className="mb-1 font-bold text-heading">Notifications</h2>
        <p className="mb-4 text-sm text-muted">Get alerts on this phone or computer. Turn it on separately on each device you use.</p>
        <PushToggle />
      </div>
    </div>
  );
}
