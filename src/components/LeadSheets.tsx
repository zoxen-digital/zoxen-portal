"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, FileSpreadsheet, Loader2, Mail, MoreHorizontal, Phone, StickyNote, Trash2, Upload, ArrowRightCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { headerRow, mapColumns, parseCsv, rowToLead } from "@/lib/lead-sheet";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";

export type LeadRow = {
  _id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  location: string;
  website: string;
  extra: Record<string, string>;
  messaged: boolean;
  messagedAt: string | null;
  messagedBy: string;
  status: string;
  followUpAt: string | null;
  notes: string;
  query: string | null;
};

export const STATUSES = ["Pending", "Responded", "Interested", "Call later", "Not interested"];
export const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  Responded: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  Interested: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  "Call later": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  "Not interested": "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
};

// ---------- Upload ----------

async function readRows(file: File): Promise<unknown[][]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  return parseCsv(await file.text());
}

export function UploadLeadsButton({ lists }: { lists: { _id: string; name: string }[] }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [source, setSource] = useState("LinkedIn");
  const [target, setTarget] = useState("");
  const [parsed, setParsed] = useState<{ headers: string[]; rows: unknown[][]; matched: string[]; sample: ReturnType<typeof rowToLead>[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setParsed(null);
    setName("");
    setTarget("");
    setProgress("");
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) return notify("File is too big (max 15 MB)", "error");
    try {
      const all = await readRows(f);
      const h = headerRow(all);
      const headers = (all[h] || []).map((x) => String(x ?? "").trim());
      const rows = all.slice(h + 1).filter((r) => r.some((c) => String(c ?? "").trim()));
      const map = mapColumns(headers);
      if (!rows.length) return notify("No rows found in this file", "error");
      setFile(f);
      setName((n) => n || f.name.replace(/\.(csv|xlsx|xls)$/i, ""));
      setParsed({
        headers,
        rows,
        matched: headers.filter((_, i) => map[i]),
        sample: rows.slice(0, 3).map((r) => rowToLead(headers, map, r)),
      });
    } catch {
      notify("Could not read this file. Use CSV or Excel (.xlsx).", "error");
    }
  }

  async function upload() {
    if (!parsed) return;
    setBusy(true);
    try {
      const listId = target || (await api<{ _id: string }>("/api/leads/lists", "POST", { name: name || "Leads", source }))._id;
      let added = 0;
      let skipped = 0;
      const BATCH = 500;
      for (let i = 0; i < parsed.rows.length; i += BATCH) {
        setProgress(`Importing ${Math.min(i + BATCH, parsed.rows.length)} of ${parsed.rows.length}...`);
        const rows = parsed.rows.slice(i, i + BATCH).map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c)));
        const r = await api<{ added: number; skipped: number }>(`/api/leads/lists/${listId}/rows`, "POST", { headers: parsed.headers, rows });
        added += r.added;
        skipped += r.skipped;
      }
      notify(`Imported ${added} lead${added === 1 ? "" : "s"}${skipped ? `, ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""}`);
      setOpen(false);
      reset();
      router.push(`/leads?list=${listId}`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Upload className="h-4 w-4" /> Upload sheet
      </button>
      <Modal
        open={open}
        onClose={() => {
          if (busy) return;
          setOpen(false);
          reset();
        }}
        title="Upload leads"
        subtitle="CSV or Excel from LinkedIn, Sales Navigator, Apollo or any list. Columns are matched automatically."
        size="lg"
      >
        <div className="space-y-4">
          <input ref={input} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files?.[0]);
            }}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center transition hover:border-brand hover:bg-brand/5"
          >
            <FileSpreadsheet className="h-8 w-8 text-brand dark:text-[#8f9bff]" />
            <span className="font-semibold text-heading">{file ? file.name : "Choose a file or drop it here"}</span>
            <span className="text-xs text-muted">{parsed ? `${parsed.rows.length} rows found` : ".csv, .xlsx or .xls"}</span>
          </button>

          {parsed && (
            <>
              <div className="rounded-xl bg-surface-2 p-3 text-xs">
                <div className="mb-1 font-semibold text-heading">Matched columns</div>
                {parsed.matched.length ? (
                  <div className="flex flex-wrap gap-1">
                    {parsed.matched.map((m) => (
                      <span key={m} className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-amber-600">No standard columns found. Rows will still import, with every column kept as details.</p>
                )}
                <div className="mt-2 space-y-1 text-muted">
                  {parsed.sample.filter(Boolean).map((s, i) => (
                    <div key={i} className="truncate">
                      {i + 1}. <b className="text-fg">{s!.name || "(no name)"}</b> {s!.company && `· ${s!.company}`} {s!.title && `· ${s!.title}`}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Add to">
                  <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">A new sheet</option>
                    {lists.map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {!target && (
                  <Field label="Source">
                    <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                      {["LinkedIn", "Sales Navigator", "Apollo", "Facebook", "Instagram", "Google Maps", "Other"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                )}
                {!target && (
                  <Field label="Sheet name" className="sm:col-span-2">
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dubai real estate agents - Oct" />
                  </Field>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2">
            {progress && <span className="mr-auto text-xs text-muted">{progress}</span>}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={busy}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button onClick={upload} disabled={!parsed || busy} className="btn btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Import {parsed ? parsed.rows.length : ""} leads
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ---------- Table ----------

export function LeadsTable({ initial }: { initial: LeadRow[] }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  const [rows, setRows] = useState(initial);
  const [noteFor, setNoteFor] = useState<LeadRow | null>(null);
  const [note, setNote] = useState("");
  const [menu, setMenu] = useState("");
  const [detail, setDetail] = useState<LeadRow | null>(null);

  // Server data changed (filter, page, upload): take the new rows.
  const sig = initial.map((r) => r._id).join(",");
  const [lastSig, setLastSig] = useState(sig);
  if (sig !== lastSig) {
    setLastSig(sig);
    setRows(initial);
  }

  async function save(id: string, patch: Partial<LeadRow>) {
    const before = rows;
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch, ...(patch.status && patch.status !== "Pending" ? { messaged: true } : {}) } : r)));
    try {
      await api(`/api/leads/${id}`, "PATCH", patch);
      router.refresh();
    } catch (e) {
      setRows(before);
      notify((e as Error).message, "error");
    }
  }

  async function toQuery(r: LeadRow) {
    setMenu("");
    if (r.query) return router.push(`/queries?q=${encodeURIComponent(r.company || r.name)}`);
    try {
      const res = await api<{ queryId: string; existed?: boolean }>(`/api/leads/${r._id}/query`, "POST");
      setRows((rs) => rs.map((x) => (x._id === r._id ? { ...x, query: res.queryId } : x)));
      notify(res.existed ? "Already in Queries" : "Added to Queries");
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function remove(r: LeadRow) {
    setMenu("");
    if (!(await confirm({ title: `Delete ${r.name || "this lead"}?`, message: "It goes to the recycle bin.", confirmText: "Delete", tone: "danger" }))) return;
    setRows((rs) => rs.filter((x) => x._id !== r._id));
    await api(`/api/leads/${r._id}`, "DELETE").catch(() => {});
    router.refresh();
  }

  const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="w-24 px-3 py-3 text-center">Messaged</th>
              <th className="px-3 py-3">Person</th>
              <th className="px-3 py-3">Company / Title</th>
              <th className="px-3 py-3">Contact</th>
              <th className="px-3 py-3">Response</th>
              <th className="px-3 py-3">Follow up</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const due = r.status === "Call later" && r.followUpAt && day(r.followUpAt) <= today;
              return (
                <tr key={r._id} className={cn("transition", r.messaged ? "bg-emerald-500/[0.03]" : "hover:bg-surface-2/50")}>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => save(r._id, { messaged: !r.messaged })}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 transition",
                        r.messaged ? "border-emerald-500 bg-emerald-500 text-white" : "border-line text-transparent hover:border-emerald-400"
                      )}
                      title={r.messaged ? `Messaged${r.messagedBy ? ` by ${r.messagedBy}` : ""}${r.messagedAt ? ` on ${new Date(r.messagedAt).toLocaleDateString()}` : ""}` : "Mark as messaged"}
                      aria-label="Messaged"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setDetail(r)} className="block max-w-[200px] truncate text-left font-semibold text-heading hover:text-brand">
                      {r.name || "(no name)"}
                    </button>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      {r.linkedin && (
                        <a href={r.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0a66c2] hover:underline">
                          LinkedIn <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {r.location && <span className="max-w-[120px] truncate">{r.location}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[200px] truncate font-medium">{r.company || "—"}</div>
                    <div className="max-w-[200px] truncate text-xs text-muted">{r.title}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.email && (
                      <a href={`mailto:${r.email}`} className="flex max-w-[180px] items-center gap-1 truncate hover:underline">
                        <Mail className="h-3 w-3 shrink-0 text-muted" /> {r.email}
                      </a>
                    )}
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3 shrink-0 text-muted" /> {r.phone}
                      </a>
                    )}
                    {!r.email && !r.phone && <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={r.status}
                      onChange={(e) => save(r._id, { status: e.target.value })}
                      className={cn("rounded-lg border-0 px-2 py-1 text-xs font-semibold outline-none", STATUS_STYLE[r.status])}
                      aria-label="Response"
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    {r.notes && (
                      <button onClick={() => (setNoteFor(r), setNote(r.notes))} className="mt-1 block max-w-[170px] truncate text-left text-[11px] text-amber-600" title={r.notes}>
                        {r.notes}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.status === "Call later" ? (
                      <input
                        type="date"
                        value={day(r.followUpAt)}
                        onChange={(e) => save(r._id, { followUpAt: e.target.value || null })}
                        className={cn("rounded-lg border px-2 py-1 text-xs", due ? "border-red-400 text-red-600" : "border-line")}
                      />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="relative px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.query && <span className="rounded bg-violet/10 px-1.5 py-0.5 text-[10px] font-bold text-violet">In Queries</span>}
                      <button onClick={() => setMenu(menu === r._id ? "" : r._id)} className="btn btn-ghost btn-sm px-2" aria-label="More">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                    {menu === r._id && (
                      <div className="card absolute right-3 top-full z-20 w-48 p-1 text-left shadow-xl">
                        <button onClick={() => (setMenu(""), setNoteFor(r), setNote(r.notes))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                          <StickyNote className="h-4 w-4" /> {r.notes ? "Edit note" : "Add note"}
                        </button>
                        <button onClick={() => toQuery(r)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                          <ArrowRightCircle className="h-4 w-4" /> {r.query ? "Open in Queries" : "Add to Queries"}
                        </button>
                        <button onClick={() => remove(r)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={`Note: ${noteFor?.name || "lead"}`} subtitle="What they said, when to follow up, anything useful.">
        <textarea className="input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => setNoteFor(null)} className="btn btn-outline">
            Cancel
          </button>
          <button
            onClick={() => {
              if (noteFor) save(noteFor._id, { notes: note });
              setNoteFor(null);
            }}
            className="btn btn-primary"
          >
            Save note
          </button>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || "Lead"} subtitle={[detail?.title, detail?.company].filter(Boolean).join(" · ")} size="lg">
        {detail && (
          <div className="space-y-1 text-sm">
            {(
              [
                ["Email", detail.email],
                ["Phone", detail.phone],
                ["LinkedIn", detail.linkedin],
                ["Location", detail.location],
                ["Website", detail.website],
                ...Object.entries(detail.extra || {}),
              ] as [string, string][]
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-3 border-b border-line py-2 last:border-0">
                  <span className="w-36 shrink-0 text-xs text-muted">{k}</span>
                  <span className="min-w-0 break-words">{/^https?:\/\//.test(v) ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{v}</a> : v}</span>
                </div>
              ))}
          </div>
        )}
      </Modal>
    </>
  );
}

export function SheetActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { notify, confirm } = useDialogs();
  async function rename() {
    const next = window.prompt("Sheet name", name)?.trim();
    if (!next || next === name) return;
    try {
      await api(`/api/leads/lists/${id}`, "PATCH", { name: next });
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  async function remove() {
    if (!(await confirm({ title: `Delete "${name}"?`, message: "The sheet and all its leads go to the recycle bin (30 days).", confirmText: "Delete sheet", tone: "danger" }))) return;
    await api(`/api/leads/lists/${id}`, "DELETE");
    router.push("/leads");
    router.refresh();
  }
  return (
    <div className="flex gap-1">
      <button onClick={rename} className="btn btn-ghost btn-sm">
        Rename
      </button>
      <button onClick={remove} className="btn btn-ghost btn-sm text-red-500">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
