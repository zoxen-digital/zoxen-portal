"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, ListTodo, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";

type Person = { _id: string; name: string };
type TaskT = {
  _id: string;
  title: string;
  description: string;
  dueAt: string | null;
  done: boolean;
  doneAt: string | null;
  assignee: Person;
  createdBy: Person;
};

const DAY = 86_400_000;
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "datetime-local" input value in the viewer's own time zone. */
function toInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function dueLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = startOfDay(d);
  const today = startOfDay();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (day === today) return `Today, ${time}`;
  if (day === today + DAY) return `Tomorrow, ${time}`;
  if (day === today - DAY) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${time}`;
}

export function MyTasks({ me, team }: { me: string; team: Person[] }) {
  const [tasks, setTasks] = useState<TaskT[] | null>(null);
  const [view, setView] = useState<"mine" | "given">("mine");
  const [editing, setEditing] = useState<TaskT | "new" | null>(null);
  const [showDone, setShowDone] = useState(false);
  const { notify } = useDialogs();

  const load = useCallback(async () => {
    try {
      setTasks(await api<TaskT[]>("/api/tasks"));
    } catch (e) {
      setTasks((t) => t || []);
      notify((e as Error).message, "error");
    }
  }, [notify]);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: TaskT) {
    setTasks((all) => all && all.map((x) => (x._id === t._id ? { ...x, done: !x.done } : x)));
    try {
      await api(`/api/tasks/${t._id}`, "PATCH", { done: !t.done });
      if (!t.done) notify("Task done. Nice work.", "success");
    } catch (e) {
      notify((e as Error).message, "error");
    }
    load();
  }

  const list = (tasks || []).filter((t) => (view === "mine" ? t.assignee?._id === me : t.createdBy?._id === me && t.assignee?._id !== me));
  const open = list.filter((t) => !t.done);
  const done = list.filter((t) => t.done);
  const now = Date.now();
  const tomorrow = startOfDay() + DAY;
  const groups = [
    { key: "overdue", title: "Overdue", tone: "text-red-500", items: open.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now) },
    { key: "today", title: "Today", tone: "text-amber-500", items: open.filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= now && new Date(t.dueAt).getTime() < tomorrow) },
    { key: "later", title: "Upcoming", tone: "text-brand dark:text-[#8f9bff]", items: open.filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= tomorrow) },
    { key: "nodate", title: "No due date", tone: "text-muted", items: open.filter((t) => !t.dueAt) },
  ].filter((g) => g.items.length);
  const givenCount = (tasks || []).filter((t) => t.createdBy?._id === me && t.assignee?._id !== me && !t.done).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand dark:text-[#8f9bff]">
          <ListTodo className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-heading">
            Tasks <span className="text-muted">({open.length})</span>
          </h2>
          <p className="text-xs text-muted">Your own to-dos and work given to the team.</p>
        </div>
        <div className="flex rounded-full bg-surface-2 p-1 text-xs font-semibold">
          {(["mine", "given"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-full px-3 py-1.5", view === v ? "bg-surface text-heading shadow-sm" : "text-muted hover:text-heading")}>
              {v === "mine" ? "My tasks" : `Given by me${givenCount ? ` (${givenCount})` : ""}`}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> New task
        </button>
      </div>

      {!tasks ? (
        <div className="flex justify-center p-8 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : open.length === 0 && !done.length ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <ListTodo className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">{view === "mine" ? "No tasks yet. Add one for yourself or give one to the team." : "You have not given any tasks yet."}</p>
          <button className="btn btn-outline btn-sm mt-1" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> New task
          </button>
        </div>
      ) : (
        <div>
          {open.length === 0 && <p className="p-5 text-sm text-muted">All tasks are done.</p>}
          {groups.map((g) => (
            <div key={g.key}>
              <div className={cn("bg-surface-2/60 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide", g.tone)}>
                {g.title} · {g.items.length}
              </div>
              <ul className="divide-y divide-line">
                {g.items.map((t) => (
                  <Row key={t._id} t={t} me={me} overdue={g.key === "overdue"} onToggle={() => toggle(t)} onOpen={() => setEditing(t)} />
                ))}
              </ul>
            </div>
          ))}
          {done.length > 0 && (
            <div className="border-t border-line">
              <button className="w-full px-4 py-2.5 text-left text-xs font-semibold text-muted hover:text-heading" onClick={() => setShowDone(!showDone)}>
                {showDone ? "Hide" : "Show"} completed ({done.length})
              </button>
              {showDone && (
                <ul className="divide-y divide-line">
                  {done.slice(0, 30).map((t) => (
                    <Row key={t._id} t={t} me={me} onToggle={() => toggle(t)} onOpen={() => setEditing(t)} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {editing && <TaskModal task={editing === "new" ? null : editing} me={me} team={team} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function Row({ t, me, overdue, onToggle, onOpen }: { t: TaskT; me: string; overdue?: boolean; onToggle: () => void; onOpen: () => void }) {
  const other = t.assignee?._id !== me ? `For ${t.assignee?.name}` : t.createdBy?._id !== me ? `From ${t.createdBy?.name}` : "";
  return (
    <li className="group flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
      <button
        onClick={onToggle}
        aria-label={t.done ? "Mark as not done" : "Mark as done"}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
          t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line hover:border-emerald-500"
        )}
      >
        {t.done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-sm font-semibold", t.done ? "text-muted line-through" : "text-heading")}>{t.title}</span>
        {t.description && <span className="block truncate text-xs text-muted">{t.description}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          {t.dueAt && (
            <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold", overdue ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300" : "bg-surface-2 text-muted")}>
              <CalendarClock className="h-3 w-3" /> {dueLabel(t.dueAt)}
            </span>
          )}
          {other && (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
              <UserRound className="h-3 w-3" /> {other}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function TaskModal({ task, me, team, onClose, onSaved }: { task: TaskT | null; me: string; team: Person[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: task?.title || "",
    description: task?.description || "",
    dueAt: toInput(task?.dueAt || null),
    assignee: task?.assignee?._id || me,
  });
  const [busy, setBusy] = useState(false);
  const { notify, confirm } = useDialogs();

  const quick = (days: number) => {
    const d = new Date(startOfDay() + days * DAY + 17 * 3_600_000);
    setF({ ...f, dueAt: toInput(d.toISOString()) });
  };

  async function save() {
    setBusy(true);
    try {
      const body = { ...f, dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : null };
      if (task) await api(`/api/tasks/${task._id}`, "PATCH", body);
      else await api("/api/tasks", "POST", body);
      notify(task ? "Task updated." : f.assignee === me ? "Task added." : "Task assigned.", "success");
      onSaved();
      onClose();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!task || !(await confirm({ title: "Delete this task?", tone: "danger", confirmText: "Delete" }))) return;
    try {
      await api(`/api/tasks/${task._id}`, "DELETE");
      onSaved();
      onClose();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  return (
    <Modal open onClose={onClose} title={task ? "Edit task" : "New task"} subtitle="Shows on My Day for the person it is assigned to.">
      <div className="space-y-4">
        <Field label="Task">
          <input autoFocus className="input" placeholder="e.g. Send the homepage design to the client" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && f.title.trim() && save()} />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-[100px]" placeholder="Details, links, what done looks like" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date">
            <input type="datetime-local" className="input" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} />
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {[
                ["Today", 0],
                ["Tomorrow", 1],
                ["Next week", 7],
              ].map(([l, d]) => (
                <button key={l} type="button" className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-muted hover:text-heading" onClick={() => quick(d as number)}>
                  {l}
                </button>
              ))}
              {f.dueAt && (
                <button type="button" className="rounded-full px-2.5 py-1 font-semibold text-muted hover:text-red-600" onClick={() => setF({ ...f, dueAt: "" })}>
                  Clear
                </button>
              )}
            </div>
          </Field>
          <Field label="Assign to">
            <select className="input" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
              {team.map((p) => (
                <option key={p._id} value={p._id}>
                  {p._id === me ? `Me (${p.name})` : p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-center gap-2 border-t border-line pt-4">
          {task && (
            <button className="btn btn-ghost text-red-600" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy || !f.title.trim()} onClick={save}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {task ? "Save" : f.assignee === me ? "Add task" : "Assign task"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
