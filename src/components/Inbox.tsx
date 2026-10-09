"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AtSign, Flag, Loader2, Lock, MessagesSquare, Search, Send, UserRound, FolderKanban } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { AttachmentList, AttachmentPicker } from "./FileUpload";
import { useDialogs } from "./Dialogs";
import type { AttachmentT } from "@/lib/types";
import { useFillHeight } from "./useFillHeight";
import { Linkify } from "./Linkify";

type Row = {
  client: string;
  name: string;
  contact: string;
  assignedTo: { _id: string; name: string } | null;
  priority: string;
  project: string;
  lastMessageAt: string;
  lastPreview: string;
  lastAuthorName: string;
  lastAuthorRole: string;
  lastRepliedBy: string;
  waiting: boolean;
  unread: number;
};
type Staff = { _id: string; name: string; title: string; role: string };
type Msg = { _id: string; authorName: string; authorRole: string; body: string; attachments: AttachmentT[]; internal: boolean; project: { _id: string; title: string } | null; createdAt: string };
type Thread = {
  client: { _id: string; name: string; contact: string; email: string; phone: string };
  conversation: { assignedTo: string | null; priority: string; project: string | null; lastRepliedBy: string; clientReadAt: string | null };
  projects: { _id: string; title: string; stage: string }[];
  messages: Msg[];
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
  { key: "urgent", label: "Priority" },
];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const PRIORITY_STYLE: Record<string, string> = {
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  Normal: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  High: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Urgent: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
};

function shortTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const y = new Date(now.getTime() - 86_400_000);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === new Date(t.getTime() - 86_400_000).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === t.getFullYear() ? undefined : "numeric" });
}

/** Polls `fn` every `ms` while the tab is visible. */
function usePoll(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && ref.current(), ms);
    const onVis = () => document.visibilityState === "visible" && ref.current();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms]);
}

/** Highlights @Name mentions of team members inside a message. */
function Body({ text, staff, light }: { text: string; staff: Staff[]; light?: boolean }) {
  const names = staff.map((s) => s.name).sort((a, b) => b.length - a.length);
  if (!names.length || !text.includes("@"))
    return (
      <p className="whitespace-pre-wrap break-words">
        <Linkify text={text} light={light} />
      </p>
    );
  const rx = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  return (
    <p className="whitespace-pre-wrap break-words">
      {text.split(rx).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={cn("rounded px-0.5 font-semibold", light ? "bg-white/20" : "bg-brand/10 text-brand dark:text-[#8f9bff]")}>
            {part}
          </span>
        ) : (
          <Linkify key={i} text={part} light={light} />
        )
      )}
    </p>
  );
}

export function Inbox({ meId, canStart }: { meId: string; canStart: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const active = params.get("c") || "";
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);

  const loadList = useCallback(async () => {
    try {
      const r = await api<{ rows: Row[]; staff: Staff[] }>(`/api/inbox?filter=${filter}&q=${encodeURIComponent(q)}`);
      setRows(r.rows);
      setStaff(r.staff);
    } catch {
      setRows((x) => x ?? []);
    }
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(loadList, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [loadList, q]);
  usePoll(loadList, 6000);

  const box = useFillHeight<HTMLDivElement>();
  const open = (id: string) => router.push(id ? `/inbox?c=${id}` : "/inbox", { scroll: false });

  return (
    <div ref={box} className="-mx-4 -mb-12 -mt-6 flex overflow-hidden border-t border-line bg-surface sm:-mx-6 lg:-mx-8">
      {/* Chat list */}
      <aside className={cn("w-full shrink-0 flex-col border-r border-line md:w-[340px] lg:w-[370px]", active ? "hidden md:flex" : "flex")}>
        <div className="space-y-3 border-b border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-heading">Inbox</h1>
            {canStart && <NewChat onPick={open} />}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition", filter === f.key ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted hover:text-fg")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows === null ? (
            <div className="flex justify-center py-10 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">{q ? "No chats match your search." : "No chats here yet."}</p>
          ) : (
            rows.map((r) => (
              <button
                key={r.client}
                onClick={() => open(r.client)}
                className={cn("flex w-full items-start gap-3 border-b border-line/60 px-3 py-3 text-left transition hover:bg-surface-2", active === r.client && "bg-brand/5")}
              >
                <Avatar name={r.name} className="h-11 w-11 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={cn("flex-1 truncate text-sm text-heading", r.unread ? "font-bold" : "font-semibold")}>{r.name}</span>
                    <span className={cn("shrink-0 text-[11px]", r.unread ? "font-semibold text-emerald-600" : "text-muted")}>{shortTime(r.lastMessageAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={cn("flex-1 truncate text-xs", r.unread ? "font-medium text-fg" : "text-muted")}>
                      {r.lastAuthorRole && r.lastAuthorRole !== "client" ? `${r.lastAuthorName.split(" ")[0]}: ` : ""}
                      {r.lastPreview}
                    </span>
                    {r.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{r.unread}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                    {r.priority !== "Normal" && <span className={cn("rounded px-1.5 py-0.5", PRIORITY_STYLE[r.priority])}>{r.priority}</span>}
                    <span className={cn("rounded px-1.5 py-0.5", r.assignedTo ? "bg-surface-2 text-fg" : "bg-surface-2 text-muted")}>
                      {r.assignedTo ? (r.assignedTo._id === meId ? "You" : r.assignedTo.name) : "Unassigned"}
                    </span>
                    {r.project && <span className="max-w-[140px] truncate rounded bg-surface-2 px-1.5 py-0.5 text-muted">{r.project}</span>}
                    {r.waiting && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Needs reply</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className={cn("min-w-0 flex-1 flex-col", active ? "flex" : "hidden md:flex")}>
        {active ? (
          <ChatPane key={active} clientId={active} staff={staff} meId={meId} onBack={() => open("")} onChanged={loadList} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted">
            <MessagesSquare className="h-12 w-12 opacity-40" />
            <div className="font-semibold text-heading">Pick a chat</div>
            <p className="max-w-sm text-sm">Every client has one chat here. Reply, assign it to a teammate, or tag someone with @ in an internal note. Clients never see notes, assignments or who on the team replied.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function NewChat({ onPick }: { onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<{ _id: string; name: string; company?: string }[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open && clients === null) api<{ _id: string; name: string; company?: string }[]>("/api/clients").then(setClients).catch(() => setClients([]));
  }, [open, clients]);
  const list = (clients || []).filter((c) => `${c.company || ""} ${c.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn btn-primary btn-sm">
        New chat
      </button>
      {open && (
        <div className="card absolute right-0 z-20 mt-2 w-72 p-2 shadow-xl">
          <input autoFocus className="input mb-2" placeholder="Find a client" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-72 overflow-y-auto">
            {clients === null ? (
              <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin text-muted" />
            ) : (
              list.map((c) => (
                <button
                  key={c._id}
                  onClick={() => {
                    setOpen(false);
                    onPick(c._id);
                  }}
                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  {c.company || c.name}
                  {c.company && <span className="text-muted"> · {c.name}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatPane({ clientId, staff, meId, onBack, onChanged }: { clientId: string; staff: Staff[]; meId: string; onBack: () => void; onChanged: () => void }) {
  const { notify } = useDialogs();
  const [t, setT] = useState<Thread | null>(null);
  const [missing, setMissing] = useState(false);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<AttachmentT[]>([]);
  const [project, setProject] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [mention, setMention] = useState<{ q: string; at: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await api<Thread>(`/api/inbox/${clientId}`);
      setT(r);
      setProject((p) => p || r.conversation.project || "");
    } catch {
      setMissing(true);
    }
  }, [clientId]);

  const router = useRouter();
  useEffect(() => {
    // Opening marks it read: refresh the list and the sidebar badge.
    load().then(() => {
      onChanged();
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  usePoll(load, 4000);

  useEffect(() => {
    if (!t || t.messages.length === lastCount.current) return;
    lastCount.current = t.messages.length;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [t]);

  async function update(patch: Record<string, unknown>) {
    try {
      await api(`/api/inbox/${clientId}`, "PUT", patch);
      await load();
      onChanged();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const mentionOptions = useMemo(
    () => (mention ? staff.filter((s) => s._id !== meId && s.name.toLowerCase().includes(mention.q.toLowerCase())).slice(0, 6) : []),
    [mention, staff, meId]
  );

  function onType(v: string, caret: number) {
    setBody(v);
    const before = v.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\w .'-]{0,30})$/);
    if (m && !m[1]!.includes("  ")) setMention({ q: m[1]!.trimStart(), at: caret - m[1]!.length - 1 });
    else setMention(null);
  }

  function pickMention(s: Staff) {
    if (!mention) return;
    const caret = boxRef.current?.selectionStart ?? body.length;
    const next = body.slice(0, mention.at) + "@" + s.name + " " + body.slice(caret);
    setBody(next);
    setMention(null);
    // Tagging someone makes it an internal note, so the client never sees team chatter.
    setMode("note");
    requestAnimationFrame(() => boxRef.current?.focus());
  }

  async function send() {
    if (sending || (!body.trim() && !files.length)) return;
    const mentions = staff.filter((s) => body.includes("@" + s.name)).map((s) => s._id);
    setSending(true);
    try {
      await api(`/api/inbox/${clientId}/messages`, "POST", { body, attachments: files, internal: mode === "note", mentions, project: project || null });
      setBody("");
      setFiles([]);
      setMention(null);
      await load();
      onChanged();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  if (missing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted">
        <p>This chat is not available to you.</p>
        <button onClick={onBack} className="btn btn-outline btn-sm">
          Back to inbox
        </button>
      </div>
    );
  }
  if (!t) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const c = t.conversation;
  let lastDay = "";
  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <button onClick={onBack} className="btn btn-ghost btn-sm px-2 md:hidden" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={t.client.name} className="h-10 w-10 text-xs" />
        <div className="min-w-0 flex-1">
          <Link href={`/clients/${t.client._id}`} className="block truncate font-bold text-heading hover:underline">
            {t.client.name}
          </Link>
          <div className="truncate text-xs text-muted">
            {[t.client.contact, c.lastRepliedBy && `Last reply by ${c.lastRepliedBy}`].filter(Boolean).join(" · ") || t.client.email}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs">
            <UserRound className="h-3.5 w-3.5 text-muted" />
            <select className="bg-transparent text-xs outline-none" value={c.assignedTo || ""} onChange={(e) => update({ assignedTo: e.target.value || null })} aria-label="Assigned to">
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s._id} value={s._id}>
                  {s._id === meId ? `${s.name} (you)` : s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs", PRIORITY_STYLE[c.priority])}>
            <Flag className="h-3.5 w-3.5" />
            <select className="bg-transparent text-xs font-semibold outline-none" value={c.priority} onChange={(e) => update({ priority: e.target.value })} aria-label="Priority">
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          {t.projects.length > 0 && (
            <label className="flex max-w-[200px] items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs">
              <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted" />
              <select
                className="min-w-0 bg-transparent text-xs outline-none"
                value={c.project || ""}
                onChange={(e) => {
                  setProject(e.target.value);
                  update({ project: e.target.value || null });
                }}
                aria-label="Project"
              >
                <option value="">No project</option>
                {t.projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-surface-2/40 p-3 sm:p-4">
        {t.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello to start the chat.</p>
        ) : (
          t.messages.map((m) => {
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const team = m.authorRole !== "client";
            return (
              <div key={m._id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-muted shadow-sm">{day}</span>
                  </div>
                )}
                <div className={cn("flex", team ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]",
                      m.internal
                        ? "rounded-tr-sm border border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                        : team
                          ? "rounded-tr-sm bg-brand-gradient text-white"
                          : "rounded-tl-sm border border-line bg-surface text-fg"
                    )}
                  >
                    <div className={cn("mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold", m.internal ? "text-amber-700 dark:text-amber-300" : team ? "text-white/80" : "text-brand dark:text-[#8f9bff]")}>
                      {m.internal && <Lock className="h-3 w-3" />}
                      {m.authorName}
                      {m.internal && " · internal note"}
                    </div>
                    {m.body && <Body text={m.body} staff={staff} light={team && !m.internal} />}
                    <AttachmentList items={m.attachments} light={team && !m.internal} />
                    <div className={cn("mt-1 flex items-center justify-end gap-2 text-[10px]", team && !m.internal ? "text-white/70" : "text-muted")}>
                      {m.project && <span className="truncate">{m.project.title}</span>}
                      {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={cn("border-t p-3", mode === "note" ? "border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5" : "border-line")}>
        <div className="mb-2 flex items-center gap-1">
          <button onClick={() => setMode("reply")} className={cn("rounded-lg px-3 py-1 text-xs font-semibold", mode === "reply" ? "bg-brand-gradient text-white" : "text-muted hover:bg-surface-2")}>
            Reply to client
          </button>
          <button onClick={() => setMode("note")} className={cn("flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold", mode === "note" ? "bg-amber-500 text-white" : "text-muted hover:bg-surface-2")}>
            <Lock className="h-3 w-3" /> Internal note
          </button>
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-muted sm:flex">
            <AtSign className="h-3 w-3" /> Type @ to tag a teammate
          </span>
        </div>
        <div className="relative">
          {mention && mentionOptions.length > 0 && (
            <div className="card absolute bottom-full left-0 z-20 mb-2 w-64 p-1 shadow-xl">
              {mentionOptions.map((s) => (
                <button
                  key={s._id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMention(s);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <Avatar name={s.name} className="h-6 w-6 text-[9px]" />
                  <span className="truncate">{s.name}</span>
                  {s.title && <span className="truncate text-xs text-muted">{s.title}</span>}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={boxRef}
            className="input min-h-[44px] resize-none"
            rows={2}
            value={body}
            onChange={(e) => onType(e.target.value, e.target.selectionStart)}
            onKeyDown={(e) => {
              if (mention && mentionOptions.length && (e.key === "Enter" || e.key === "Tab")) {
                e.preventDefault();
                pickMention(mentionOptions[0]!);
                return;
              }
              if (e.key === "Escape") setMention(null);
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={mode === "note" ? "Internal note, only the team sees this. Type @ to tag someone." : `Message ${t.client.name}...`}
          />
        </div>
        <div className="mt-2 flex items-start justify-between gap-2">
          <AttachmentPicker value={files} onChange={setFiles} />
          <button onClick={send} className={cn("btn btn-sm", mode === "note" ? "bg-amber-500 text-white hover:bg-amber-600" : "btn-primary")} disabled={sending || (!body.trim() && !files.length)}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {mode === "note" ? "Add note" : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
