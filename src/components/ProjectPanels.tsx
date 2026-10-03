"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckSquare,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { REVISION_STATUSES } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import { Badge, CardHeader, EmptyState } from "./ui";
import { useDialogs } from "./Dialogs";
import { useUploader } from "./FileUpload";
import type { ProjectT } from "@/lib/types";

/** Shared helper: call the API, refresh the page, toast on error. */
function useAction() {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await fn();
      if (success) notify(success);
      router.refresh();
      return true;
    } catch (e) {
      notify((e as Error).message, "error");
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { run, busy, confirm };
}

const base = (p: ProjectT, kind: string) => `/api/projects/${p._id}/${kind}`;

export function ClientUpdatePanel({ project }: { project: ProjectT }) {
  const { run, busy } = useAction();
  const [f, setF] = useState({
    clientUpdate: project.clientUpdate || "",
    previewUrl: project.previewUrl || "",
    liveUrl: project.liveUrl || "",
    domain: project.domain || "",
    progress: String(project.progress),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="card">
      <CardHeader icon={MessageSquareText} title="Client update & links" subtitle="This is what the client sees on their portal." />
      <form
        className="grid gap-4 px-5 pb-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run("save", () => api(`/api/projects/${project._id}`, "PUT", f), "Saved. The client portal is updated.");
        }}
      >
        <div className="sm:col-span-2">
          <span className="label">Latest update for the client</span>
          <textarea className="input" rows={2} value={f.clientUpdate} onChange={set("clientUpdate")} placeholder="e.g. Homepage design is done, we are now building the inner pages." />
          <p className="mt-1 text-xs text-muted">Changing this notifies the client.</p>
        </div>
        <div>
          <span className="label">Preview / staging link</span>
          <input className="input" value={f.previewUrl} onChange={set("previewUrl")} placeholder="https://staging.clientsite.com" />
        </div>
        <div>
          <span className="label">Live link</span>
          <input className="input" value={f.liveUrl} onChange={set("liveUrl")} placeholder="https://clientsite.com" />
        </div>
        <div>
          <span className="label">Domain</span>
          <input className="input" value={f.domain} onChange={set("domain")} />
        </div>
        <div>
          <span className="label">Progress: {f.progress}%</span>
          <input type="range" min="0" max="100" step="5" value={f.progress} onChange={set("progress")} className="mt-2 w-full accent-[#2639e8]" />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <button className="btn btn-primary" disabled={busy === "save"}>
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save update
          </button>
        </div>
      </form>
    </div>
  );
}

export function ChecklistPanel({ project }: { project: ProjectT }) {
  const { run, busy } = useAction();
  const [label, setLabel] = useState("");
  const done = project.checklist.filter((c) => c.done).length;

  return (
    <div className="card">
      <CardHeader icon={CheckSquare} title="Checklist" subtitle={`${done} of ${project.checklist.length} done · the client sees this list`} />
      <div className="px-5 pb-5">
        <ul className="divide-y divide-line">
          {project.checklist.map((c) => (
            <li key={c._id} className="group flex items-center gap-3 py-2">
              <button
                onClick={() => run(c._id, () => api(`${base(project, "checklist")}/${c._id}`, "PUT", { done: !c.done }))}
                disabled={busy === c._id}
                className="text-brand dark:text-[#8f9bff]"
                aria-label={c.done ? "Mark not done" : "Mark done"}
              >
                {busy === c._id ? <Loader2 className="h-5 w-5 animate-spin" /> : c.done ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-muted" />}
              </button>
              <span className={cn("flex-1 text-sm", c.done && "text-muted line-through")}>{c.label}</span>
              {c.doneAt && <span className="text-xs text-muted">{formatDate(c.doneAt)}</span>}
              <button
                onClick={() => run(`del-${c._id}`, () => api(`${base(project, "checklist")}/${c._id}`, "DELETE"))}
                className="text-muted opacity-0 hover:text-red-500 group-hover:opacity-100"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("add", () => api(base(project, "checklist"), "POST", { label }))) setLabel("");
          }}
        >
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add a task, e.g. Connect Google Analytics" />
          <button className="btn btn-outline" disabled={!label.trim() || busy === "add"}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      </div>
    </div>
  );
}

export function IssuesPanel({ project, team }: { project: ProjectT; team: string[] }) {
  const { run, busy, confirm } = useAction();
  const [open, setOpen] = useState(false);
  const empty = { title: "", details: "", owner: "", dueDate: "", visibleToClient: false };
  const [f, setF] = useState(empty);
  const issues = [...project.issues].sort((a, b) => Number(a.status === "Resolved") - Number(b.status === "Resolved"));
  const openCount = project.issues.filter((i) => i.status !== "Resolved").length;

  return (
    <div className="card">
      <CardHeader
        icon={AlertTriangle}
        title="Issues & blockers"
        subtitle={openCount ? `${openCount} open · errors, domain/DNS problems, missing content` : "Errors, domain/DNS problems, missing content"}
        action={
          <button onClick={() => setOpen((o) => !o)} className="btn btn-outline btn-sm">
            <Plus className="h-4 w-4" /> Log issue
          </button>
        }
      />
      <div className="px-5 pb-5">
        {open && (
          <form
            className="mb-4 grid gap-3 rounded-xl border border-line bg-surface-2/50 p-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("add", () => api(base(project, "issues"), "POST", f), "Issue logged")) {
                setF(empty);
                setOpen(false);
              }
            }}
          >
            <input className="input sm:col-span-2" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="What is wrong? e.g. Domain DNS not pointing to hosting" />
            <textarea className="input sm:col-span-2" rows={2} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} placeholder="Details / what is needed to fix it" />
            <input className="input" list="issue-owners" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="Owner (who fixes it)" />
            <datalist id="issue-owners">
              {[...team, "Client"].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <input className="input" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={f.visibleToClient} onChange={(e) => setF({ ...f, visibleToClient: e.target.checked })} />
              Show to client as &quot;Action needed&quot; (they get notified, e.g. &quot;Please send your logo&quot;)
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-sm">Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={busy === "add"}>
                {busy === "add" && <Loader2 className="h-4 w-4 animate-spin" />} Save issue
              </button>
            </div>
          </form>
        )}
        {issues.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">No issues logged. Good.</p>
        ) : (
          <ul className="space-y-2">
            {issues.map((i) => {
              const resolved = i.status === "Resolved";
              const late = isOverdue(i.dueDate, resolved);
              return (
                <li key={i._id} className={cn("rounded-xl border border-line p-3", resolved && "opacity-60")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm font-semibold text-heading", resolved && "line-through")}>{i.title}</div>
                      {i.details && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{i.details}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Badge status={i.status} />
                        {i.owner ? <span>Owner: <b className="text-fg">{i.owner}</b></span> : <span className="text-red-500">No owner</span>}
                        {i.dueDate && <span className={late ? "font-semibold text-red-500" : ""}>Due {formatDate(i.dueDate)}</span>}
                        {i.visibleToClient && (
                          <span className="inline-flex items-center gap-1 text-violet"><Eye className="h-3 w-3" /> Client sees this</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-sm px-2"
                        title={i.visibleToClient ? "Hide from client" : "Show to client"}
                        onClick={() => run(`v-${i._id}`, () => api(`${base(project, "issues")}/${i._id}`, "PUT", { visibleToClient: !i.visibleToClient }))}
                      >
                        {i.visibleToClient ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={busy === i._id}
                        onClick={() => run(i._id, () => api(`${base(project, "issues")}/${i._id}`, "PUT", { status: resolved ? "Open" : "Resolved" }))}
                      >
                        {busy === i._id && <Loader2 className="h-4 w-4 animate-spin" />}
                        {resolved ? "Reopen" : "Resolve"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm px-2 hover:text-red-500"
                        onClick={async () => {
                          if (await confirm({ title: "Delete this issue?", tone: "danger", confirmText: "Delete" }))
                            run(`d-${i._id}`, () => api(`${base(project, "issues")}/${i._id}`, "DELETE"));
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function RevisionsPanel({ project }: { project: ProjectT }) {
  const { run, busy } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ request: "", links: "" });
  const revisions = [...project.revisions].reverse();
  const limit = project.revisionLimit;

  return (
    <div className="card">
      <CardHeader
        icon={RefreshCcw}
        title="Revisions"
        subtitle={`${project.revisions.length} round${project.revisions.length === 1 ? "" : "s"} used${limit ? ` of ${limit} included` : " · unlimited"}`}
        action={
          <button onClick={() => setOpen((o) => !o)} className="btn btn-outline btn-sm" title="Log a request the client sent by WhatsApp or email">
            <Plus className="h-4 w-4" /> Log request
          </button>
        }
      />
      <div className="px-5 pb-5">
        {open && (
          <form
            className="mb-4 space-y-3 rounded-xl border border-line bg-surface-2/50 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("add", () => api(base(project, "revisions"), "POST", f), "Revision logged")) {
                setF({ request: "", links: "" });
                setOpen(false);
              }
            }}
          >
            <p className="text-xs text-muted">Client sent changes on WhatsApp or email? Log them here so every request is on record.</p>
            <textarea className="input" rows={3} required value={f.request} onChange={(e) => setF({ ...f, request: e.target.value })} placeholder="What the client asked to change" />
            <input className="input" value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} placeholder="Reference links / screenshots (optional)" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-sm">Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={busy === "add"}>Save</button>
            </div>
          </form>
        )}
        {revisions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">No revision requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {revisions.map((r) => (
              <li key={r._id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-heading">
                    Round {r.round}
                    {r.extra && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-500">Extra (beyond package)</span>}
                  </div>
                  <select
                    className="input h-8 w-auto rounded-lg py-0 text-xs font-semibold"
                    value={r.status}
                    disabled={busy === r._id}
                    onChange={(e) => run(r._id, () => api(`${base(project, "revisions")}/${r._id}`, "PUT", { status: e.target.value }), "Revision updated")}
                  >
                    {REVISION_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-fg">{r.request}</p>
                {r.links && <p className="mt-1 break-all text-xs text-brand dark:text-[#8f9bff]">{r.links}</p>}
                <div className="mt-1.5 text-xs text-muted">
                  {r.requestedBy} · {formatDate(r.createdAt)}
                  {r.completedAt ? ` · done ${formatDate(r.completedAt)}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function DocumentsPanel({ project, uploads }: { project: ProjectT; uploads?: boolean }) {
  const { run, busy } = useAction();
  const [f, setF] = useState({ name: "", url: "", visibleToClient: true });
  const { upload, uploading } = useUploader();

  async function uploadFiles(files: FileList) {
    const done = await upload(files);
    for (const a of done) {
      await run(`up-${a.url}`, () => api(base(project, "documents"), "POST", { name: a.name, url: a.url, visibleToClient: f.visibleToClient }));
    }
  }

  return (
    <div className="card">
      <CardHeader
        icon={FileText}
        title="Documents & files"
        subtitle="Upload files or add links (Google Drive, Figma, brand files)."
        action={
          uploads ? (
            <label className={`btn btn-outline btn-sm cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {uploading ? `${uploading.pct}%` : "Upload"}
              <input type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }} />
            </label>
          ) : undefined
        }
      />
      <div className="px-5 pb-5">
        {project.documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" />
        ) : (
          <ul className="divide-y divide-line">
            {project.documents.map((d) => (
              <li key={d._id} className="group flex items-center gap-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-muted" />
                <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-heading hover:text-brand">
                  {d.name} <ExternalLink className="inline h-3 w-3" />
                </a>
                <span className="text-xs text-muted">{d.visibleToClient ? "Client can see" : "Internal"}</span>
                <button onClick={() => run(d._id, () => api(`${base(project, "documents")}/${d._id}`, "DELETE"))} className="text-muted opacity-0 hover:text-red-500 group-hover:opacity-100" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("add", () => api(base(project, "documents"), "POST", f), "Document added")) setF({ name: "", url: "", visibleToClient: true });
          }}
        >
          <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name, e.g. Sitemap" />
          <input className="input" required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://drive.google.com/..." />
          <button className="btn btn-outline" disabled={busy === "add"}>
            <Plus className="h-4 w-4" /> Add
          </button>
          <label className="flex items-center gap-2 text-xs text-muted sm:col-span-3">
            <input type="checkbox" checked={f.visibleToClient} onChange={(e) => setF({ ...f, visibleToClient: e.target.checked })} /> Client can see this document
          </label>
        </form>
      </div>
    </div>
  );
}

export function NotesPanel({ project }: { project: ProjectT }) {
  const { run, busy } = useAction();
  const [notes, setNotes] = useState(project.internalNotes || "");
  return (
    <div className="card p-5">
      <h2 className="font-bold text-heading">Internal notes</h2>
      <p className="mb-3 text-xs text-muted">Team only. Never shown to the client.</p>
      <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Logins location, decisions, what was promised..." />
      <div className="mt-2 flex justify-end">
        <button
          className="btn btn-outline btn-sm"
          disabled={busy === "n" || notes === (project.internalNotes || "")}
          onClick={() => run("n", () => api(`/api/projects/${project._id}`, "PUT", { internalNotes: notes }), "Notes saved")}
        >
          {busy === "n" && <Loader2 className="h-4 w-4 animate-spin" />} Save notes
        </button>
      </div>
    </div>
  );
}
