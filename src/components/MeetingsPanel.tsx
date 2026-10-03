"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Plus, Trash2, Video } from "lucide-react";
import { api } from "@/lib/client-api";
import { CardHeader } from "./ui";
import { LocalTime } from "./LocalTime";
import { useDialogs } from "./Dialogs";
import type { MeetingT } from "@/lib/types";

const LINK_NOTE: Record<string, string> = {
  google: " with a new Google Meet link (calendar invite sent)",
  fixed: " with your fixed meeting link",
  none: " (no link: connect Google or add a fixed link in Settings)",
};

export function MeetingsPanel({ clientId, meetings, projects }: { clientId: string; meetings: MeetingT[]; projects: { _id: string; title: string }[] }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const empty = { title: "", date: "", link: "", notes: "", project: "", minutes: "30" };
  const [f, setF] = useState(empty);
  const now = Date.now();
  const requests = meetings.filter((m) => m.status === "Requested").reverse();
  const booked = meetings.filter((m) => m.status !== "Requested" && m.status !== "Declined");
  const upcoming = booked.filter((m) => new Date(m.date).getTime() >= now).reverse();
  const past = booked.filter((m) => new Date(m.date).getTime() < now);

  const [confirming, setConfirming] = useState<string | null>(null);
  const [joinLink, setJoinLink] = useState("");

  async function respond(m: MeetingT, status: "Scheduled" | "Declined") {
    try {
      const res = await api<{ linkSource: string }>(`/api/meetings/${m._id}`, "PUT", status === "Scheduled" ? { status, link: joinLink } : { status });
      setConfirming(null);
      setJoinLink("");
      notify(status === "Scheduled" ? `Meeting confirmed${LINK_NOTE[res.linkSource] || ""}. The client was notified.` : "Request declined. The client was notified.");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // datetime-local has no zone: convert in the browser so the time means what the admin typed.
      const res = await api<{ linkSource: string }>("/api/meetings", "POST", { ...f, client: clientId, date: new Date(f.date).toISOString() });
      setF(empty);
      setOpen(false);
      notify(`Meeting added${LINK_NOTE[res.linkSource] || ""}. The client was notified.`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: MeetingT) {
    if (!(await confirm({ title: `Delete "${m.title}"?`, tone: "danger", confirmText: "Delete" }))) return;
    try {
      await api(`/api/meetings/${m._id}`, "DELETE");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const row = (m: MeetingT) => (
    <li key={m._id} className="group flex items-start gap-3 py-2.5">
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold text-heading">{m.title}</div>
        <div className="text-xs text-muted">
          <LocalTime iso={m.date} />
        </div>
        {m.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{m.notes}</p>}
      </div>
      {m.link && (
        <a href={m.link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm px-2" title="Join link">
          <Video className="h-4 w-4" />
        </a>
      )}
      <button onClick={() => remove(m)} className="btn btn-ghost btn-sm px-2 opacity-0 hover:text-red-500 group-hover:opacity-100" aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );

  return (
    <div className="card">
      <CardHeader
        icon={CalendarDays}
        title="Meetings"
        subtitle={`${requests.length ? `${requests.length} request${requests.length > 1 ? "s" : ""} waiting · ` : ""}${upcoming.length} upcoming · ${past.length} past`}
        action={
          <button onClick={() => setOpen((o) => !o)} className="btn btn-outline btn-sm">
            <Plus className="h-4 w-4" /> Add
          </button>
        }
      />
      <div className="px-5 pb-5">
        {open && (
          <form onSubmit={add} className="mb-4 grid gap-3 rounded-xl border border-line bg-surface-2/50 p-4 sm:grid-cols-2">
            <input className="input sm:col-span-2" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Design review call" />
            <input className="input" type="datetime-local" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <input className="input" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="Leave empty for an automatic Meet link" />
            <select className="input" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} aria-label="Duration">
              {["15", "30", "45", "60", "90"].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
            {projects.length > 0 && (
              <select className="input sm:col-span-2" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>
                <option value="">Not linked to a project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.title}</option>
                ))}
              </select>
            )}
            <textarea className="input sm:col-span-2" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Agenda or summary (the client can see this)" />
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-sm">Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save meeting
              </button>
            </div>
          </form>
        )}
        {requests.length > 0 && (
          <div className="mb-4 space-y-2">
            {requests.map((m) => (
              <div key={m._id} className="rounded-xl border border-violet/30 bg-violet/5 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <div className="text-xs font-bold uppercase tracking-wide text-violet">Client request</div>
                    <div className="font-semibold text-heading">{m.title}</div>
                    <div className="text-xs text-muted">
                      Preferred: <LocalTime iso={m.date} /> · by {m.createdBy}
                    </div>
                    {m.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{m.notes}</p>}
                  </div>
                  {confirming !== m._id && (
                    <div className="flex gap-2">
                      <button onClick={() => respond(m, "Declined")} className="btn btn-outline btn-sm">Decline</button>
                      <button onClick={() => setConfirming(m._id)} className="btn btn-primary btn-sm">Confirm</button>
                    </div>
                  )}
                </div>
                {confirming === m._id && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input className="input" autoFocus value={joinLink} onChange={(e) => setJoinLink(e.target.value)} placeholder="Leave empty for an automatic Meet link" />
                    <button onClick={() => setConfirming(null)} className="btn btn-outline">Back</button>
                    <button onClick={() => respond(m, "Scheduled")} className="btn btn-primary">Confirm meeting</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {booked.length === 0 && requests.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">No meetings yet.</p>
        ) : (
          <>
            {upcoming.length > 0 && <ul className="divide-y divide-line">{upcoming.map(row)}</ul>}
            {past.length > 0 && (
              <>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Past</div>
                <ul className="divide-y divide-line opacity-80">{past.slice(0, 6).map(row)}</ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
