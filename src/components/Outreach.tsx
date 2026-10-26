"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailCheck,
  MailX,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Square,
  Star,
  Store,
  Trash2,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { cn, formatDate } from "@/lib/utils";
import { CardHeader, EmptyState, Field, PageHeader, StatCard } from "./ui";
import { Drawer } from "./Drawer";
import { useDialogs } from "./Dialogs";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "prospects", label: "Prospects" },
  { key: "replies", label: "Replies" },
  { key: "settings", label: "Settings" },
] as const;

const STAGE_LABEL: Record<string, string> = {
  new: "Found",
  audited: "Checked",
  ready: "Email ready",
  sending: "Sending",
  sent: "Sent",
  replied: "Replied",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
  no_email: "No email found",
  skipped: "Skipped",
  completed: "No response",
  error: "Error",
};
const STAGE_STYLE: Record<string, string> = {
  ready: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  replied: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  bounced: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
  unsubscribed: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
  error: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
};
const REPLY_STYLE: Record<string, string> = {
  Interested: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  "Follow-Up Required": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  "Not Interested": "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
  Unsubscribe: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
};
const REPLY_CATS = ["Interested", "Follow-Up Required", "Not Interested", "Out of Office", "Unsubscribe", "Other"];

function Pill({ text, style }: { text: string; style?: string }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", style || "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300")}>{text}</span>;
}

export function OutreachDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") || "overview";
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [openId, setOpenId] = useState<string | null>(params.get("p"));
  const { notify } = useDialogs();
  const alert = useCallback((m: string) => notify(m, "error"), [notify]);

  const load = useCallback(async () => {
    try {
      setData(await api("/api/outreach"));
    } catch (e) {
      alert((e as Error).message);
    }
  }, [alert]);

  useEffect(() => {
    load();
  }, [load]);

  // While this page is open and the campaign runs, do a round of work every minute (the cron does it when closed).
  const running = data?.config?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      await api("/api/outreach/tick", "POST").catch(() => {});
      load();
    }, 60_000);
    return () => clearInterval(t);
  }, [running, load]);

  async function control(action: string) {
    setBusy(action);
    try {
      await api("/api/outreach/control", "POST", { action });
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const go = (key: string) => router.replace(`/outreach?tab=${key}`, { scroll: false });

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading cold email...
      </div>
    );
  }
  const { config, stats } = data;
  const status: string = config.status;
  const unread = stats.replied ? data.unreadReplies : 0;

  return (
    <div>
      <PageHeader title="Cold Email" subtitle="Finds local businesses, checks their website, writes a personal email and follows up. Replies land here.">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
            status === "running" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : status === "paused" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", status === "running" ? "animate-pulse bg-emerald-500" : status === "paused" ? "bg-amber-500" : "bg-slate-400")} />
          {status === "running" ? "Running" : status === "paused" ? "Paused" : "Stopped"}
        </span>
        {status === "running" ? (
          <>
            <button className="btn btn-outline" disabled={!!busy} onClick={() => control("pause")}>
              {busy === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Pause
            </button>
            <button className="btn btn-outline" disabled={!!busy} onClick={() => control("stop")}>
              <Square className="h-4 w-4" /> Stop
            </button>
          </>
        ) : (
          <button className="btn btn-primary" disabled={!!busy} onClick={() => control(status === "paused" ? "resume" : "run")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {status === "paused" ? "Resume" : "Run"}
          </button>
        )}
      </PageHeader>

      <Warnings data={data} onSettings={() => go("settings")} />

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => go(t.key)}
            className={cn("-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold", tab === t.key ? "border-brand text-brand dark:border-[#8f9bff] dark:text-[#8f9bff]" : "border-transparent text-muted hover:text-heading")}
          >
            {t.label}
            {t.key === "replies" && unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview data={data} busy={busy} onRefresh={async () => { setBusy("tick"); await api("/api/outreach/tick", "POST").catch((e) => alert(e.message)); await load(); setBusy(""); }} />}
      {tab === "prospects" && <Prospects onOpen={setOpenId} />}
      {tab === "replies" && <Prospects replies onOpen={setOpenId} />}
      {tab === "settings" && <Settings data={data} reload={load} />}

      {openId && <ProspectDrawer id={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}

function Warnings({ data, onSettings }: { data: any; onSettings: () => void }) {
  const { config, mailboxes } = data;
  const items: string[] = [];
  if (config.pausedReason) items.push(`Paused automatically: ${config.pausedReason}`);
  if (!mailboxes.length) items.push("No sending mailbox connected yet.");
  for (const b of mailboxes) if (b.lastError) items.push(`${b.email}: ${b.lastError}`);
  if (!config.postalAddress) items.push("Add your business postal address (required in every cold email by US law).");
  if (!config.targets?.length) items.push("Add at least one target, for example: restaurant + Houston, TX.");
  if (!items.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1 space-y-1">
          {items.map((t) => (
            <div key={t}>{t}</div>
          ))}
        </div>
        <button className="font-semibold underline" onClick={onSettings}>
          Settings
        </button>
      </div>
    </div>
  );
}

function Overview({ data, busy, onRefresh }: { data: any; busy: string; onRefresh: () => void }) {
  const { stats, config, logs } = data;
  const bounceRate = stats.sent ? Math.round((stats.bounced / stats.sent) * 1000) / 10 : 0;
  const replyRate = stats.sent ? Math.round((stats.replied / stats.sent) * 1000) / 10 : 0;
  const funnel = [
    { label: "Businesses found", n: stats.discovered },
    { label: "Websites checked", n: stats.audited },
    { label: "Emails written", n: stats.written },
    { label: "Emails sent", n: stats.sent },
    { label: "Replies", n: stats.replied },
    { label: "Interested", n: stats.interested },
    { label: "Moved to Queries", n: stats.converted },
  ];
  const max = Math.max(1, stats.discovered);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Store} label="Businesses found" value={stats.discovered} hint={`${stats.noEmail} without a public email`} tone="slate" />
        <StatCard icon={Send} label="Sent today" value={`${stats.sentToday} / ${Math.min(stats.capToday, config.dailyLimit)}`} hint={`${stats.sent} sent in total, ${stats.waiting} ready`} tone="blue" />
        <StatCard icon={InboxIcon} label="Replies" value={stats.replied} hint={`${replyRate}% reply rate`} tone="violet" />
        <StatCard icon={Star} label="Interested" value={stats.interested} hint={`${stats.converted} moved to Queries`} tone="green" />
        <StatCard icon={MailCheck} label="Delivered" value={stats.delivered} tone="green" />
        <StatCard icon={MailX} label="Bounce rate" value={`${bounceRate}%`} hint={`Auto-pause above ${config.maxBounceRate}%`} tone={bounceRate > config.maxBounceRate ? "red" : bounceRate > 2 ? "amber" : "slate"} />
        <StatCard icon={XCircle} label="Do not contact" value={stats.suppressed} hint="Unsubscribed, bounced or declined" tone="slate" />
        <StatCard icon={Mail} label="Follow-ups" value={stats.stages.sent || 0} hint="Waiting for next follow-up" tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <CardHeader title="Pipeline" subtitle={config.lastTickAt ? `Last run ${when(config.lastTickAt)}: ${config.lastTickSummary || "-"}` : "Not run yet"} action={
            <button className="btn btn-sm btn-outline" disabled={!!busy} onClick={onRefresh}>
              {busy === "tick" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Run a round now
            </button>
          } />
          <div className="space-y-2.5 px-5 pb-5">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted">{f.label}</span>
                  <b className="text-heading">{f.n}</b>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(f.n ? 2 : 0, (f.n / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-3 text-xs text-muted">
            Targets:{" "}
            {(config.targets || []).map((t: any) => (
              <span key={t.category + t.city} className="mr-2 inline-flex items-center gap-1">
                {t.done && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                {t.category} in {t.city} ({t.found || 0})
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <CardHeader title="Activity" subtitle="Last 60 events (kept for 60 days)" />
          <div className="max-h-[420px] space-y-1 overflow-y-auto px-5 pb-5 text-sm">
            {logs.length === 0 && <div className="py-6 text-center text-muted">Nothing yet. Press Run.</div>}
            {logs.map((l: any) => (
              <div key={l._id} className="flex gap-3 border-b border-line/60 py-1.5 last:border-0">
                <span className="w-28 shrink-0 text-xs text-muted">{when(l.at)}</span>
                <span className={cn(l.level === "error" ? "text-red-600 dark:text-red-300" : l.level === "warn" ? "text-amber-700 dark:text-amber-300" : "text-heading")}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Prospects({ replies, onOpen }: { replies?: boolean; onOpen: (id: string) => void }) {
  const [stage, setStage] = useState(replies ? "replies" : "");
  const [reply, setReply] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ stage, reply, q, page: String(page) });
      setRes(await api(`/api/outreach/prospects?${sp}`).catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })));
    }, 250);
    return () => clearTimeout(t);
  }, [stage, reply, q, page]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search business, email, city" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        {replies ? (
          <select className="input w-auto" value={reply} onChange={(e) => { setReply(e.target.value); setPage(1); }}>
            <option value="">All replies</option>
            {REPLY_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        ) : (
          <select className="input w-auto" value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}>
            <option value="">All stages</option>
            <option value="no-response">No response yet</option>
            {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
      </div>
      {!res ? (
        <div className="flex justify-center py-12 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : res.items.length === 0 ? (
        <EmptyState icon={replies ? InboxIcon : Store} title={replies ? "No replies yet" : "No prospects here"} text={replies ? "Replies show up here within a few minutes. Interested ones also notify you." : "Press Run to start finding businesses."} />
      ) : (
        <div className="overflow-x-auto p-3 pt-0">
          <table className="table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Email</th>
                <th>{replies ? "Reply" : "Stage"}</th>
                <th>Website check</th>
                <th>{replies ? "Replied" : "Updated"}</th>
              </tr>
            </thead>
            <tbody>
              {res.items.map((p: any) => (
                <tr key={p._id} className="row-link cursor-pointer" onClick={() => onOpen(p._id)}>
                  <td>
                    <div className={cn("text-heading", replies && !p.reviewed ? "font-bold" : "font-semibold")}>{p.name}</div>
                    <div className="text-xs text-muted">{p.category} · {p.city}</div>
                  </td>
                  <td className="text-sm">{p.email || <span className="text-muted">-</span>}</td>
                  <td>
                    {replies ? <Pill text={p.replyCategory || "Other"} style={REPLY_STYLE[p.replyCategory]} /> : <Pill text={STAGE_LABEL[p.stage] || p.stage} style={STAGE_STYLE[p.stage]} />}
                    {p.query && <span className="ml-1"><Pill text="In Queries" style={REPLY_STYLE.Interested} /></span>}
                  </td>
                  <td className="text-xs text-muted">{p.website ? `${(p.audit?.findings || []).length} issues found` : "No website"}</td>
                  <td className="text-xs text-muted">{formatDate(replies ? p.repliedAt : p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between pt-3 text-xs text-muted">
            <span>{res.total} total</span>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="btn btn-sm btn-outline" disabled={page * res.pageSize >= res.total} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProspectDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [p, setP] = useState<any>(null);
  const [draft, setDraft] = useState({ subject: "", body: "" });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const { notify, confirm } = useDialogs();
  const alert = useCallback((m: string) => notify(m, "error"), [notify]);
  const router = useRouter();

  const load = useCallback(async () => {
    const d: any = await api(`/api/outreach/prospects/${id}`);
    setP(d);
    setDraft({ subject: d.draft?.subject || "", body: d.draft?.body || "" });
  }, [id]);
  useEffect(() => {
    load().catch((e) => alert(e.message));
  }, [load, alert]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const patch = (body: unknown) => api(`/api/outreach/prospects/${id}`, "PATCH", body);

  const editable = p && ["ready", "audited"].includes(p.stage) && p.draft;
  return (
    <Drawer open onClose={onClose} title={p?.name || "Loading..."} subtitle={p ? `${p.category} · ${p.city}` : ""} badge={p && <Pill text={STAGE_LABEL[p.stage] || p.stage} style={STAGE_STYLE[p.stage]} />}>
      {!p ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Email" value={p.email || "-"} />
            <Info label="Phone" value={p.phone || "-"} />
            <Info label="Website" value={p.website ? <a className="text-brand hover:underline dark:text-[#8f9bff]" href={p.website} target="_blank" rel="noreferrer">{p.website.replace(/^https?:\/\//, "")}</a> : "None found"} />
            <Info label="Address" value={p.address || "-"} />
          </div>

          {p.audit && (
            <div className="rounded-xl border border-line p-4">
              <div className="mb-2 font-bold text-heading">Website check{p.audit.score != null && <span className="ml-2 text-xs font-medium text-muted">score {p.audit.score}/100</span>}</div>
              {(p.audit.findings || []).length ? (
                <ul className="list-disc space-y-1 pl-5 text-muted">{p.audit.findings.map((f: string) => <li key={f}>{f}</li>)}</ul>
              ) : (
                <div className="text-muted">No major problems found.</div>
              )}
            </div>
          )}

          {editable && (
            <div className="space-y-2 rounded-xl border border-line p-4">
              <div className="font-bold text-heading">Email to send {p.draft.by === "ai" ? "(written by AI)" : p.draft.by === "edited" ? "(edited)" : "(template)"}</div>
              <input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              <textarea className="input min-h-[220px]" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm btn-outline" disabled={!!busy} onClick={() => run("save", () => patch({ draft }))}>Save changes</button>
                <button className={cn("btn btn-sm", p.approved ? "btn-outline" : "btn-primary")} disabled={!!busy} onClick={() => run("approve", () => patch({ approved: !p.approved }))}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> {p.approved ? "Approved (undo)" : "Approve"}
                </button>
                <button className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => run("skip", () => patch({ action: "skip" }))}>Skip</button>
              </div>
            </div>
          )}

          {(p.messages || []).length > 0 && (
            <div>
              <div className="mb-2 font-bold text-heading">Conversation</div>
              <div className="space-y-3">
                {p.messages.map((m: any, i: number) => (
                  <div key={i} className={cn("rounded-xl p-3", m.dir === "in" ? "border border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5" : "bg-surface-2")}>
                    <div className="mb-1 flex justify-between text-xs text-muted">
                      <span>{m.dir === "in" ? `From ${p.name}` : m.kind === "first" ? "First email" : m.kind === "manual" ? "Your reply" : `Follow-up ${String(m.kind).replace("followup", "")}`}</span>
                      <span>{when(m.at)}</span>
                    </div>
                    <div className="mb-1 font-semibold text-heading">{m.subject}</div>
                    <div className="whitespace-pre-wrap text-heading/90">{m.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.repliedAt && (
            <div className="space-y-2 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-heading">Reply</div>
                <select className="input w-auto" value={p.replyCategory || "Other"} onChange={(e) => run("cat", () => patch({ replyCategory: e.target.value }))}>
                  {REPLY_CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {!["unsubscribed", "bounced"].includes(p.stage) && (
                <>
                  <textarea className="input min-h-[120px]" placeholder="Write your reply (sent from the same mailbox, in the same thread)" value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="btn btn-sm btn-primary" disabled={!!busy || !text.trim()} onClick={() => run("reply", async () => { await api(`/api/outreach/prospects/${id}`, "POST", { action: "reply", body: text }); setText(""); })}>
                    {busy === "reply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send reply
                  </button>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {p.query ? (
              <button className="btn btn-sm btn-outline" onClick={() => router.push(`/queries/${p.query}`)}>Open in Queries</button>
            ) : (
              p.email && (
                <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => run("query", async () => { const r: any = await api(`/api/outreach/prospects/${id}`, "POST", { action: "to-query" }); router.push(`/queries/${r.queryId}`); })}>
                  <Plus className="h-3.5 w-3.5" /> Add to Queries
                </button>
              )
            )}
            {p.email && !["unsubscribed", "bounced"].includes(p.stage) && (
              <button
                className="btn btn-sm btn-ghost text-red-600"
                disabled={!!busy}
                onClick={async () => { if (await confirm({ title: "Never email this contact again?", tone: "danger", confirmText: "Do not contact" })) run("dnc", () => patch({ action: "do-not-contact" })); }}
              >
                Do not contact
              </button>
            )}
          </div>
          {p.lastError && <div className="text-xs text-red-600 dark:text-red-300">Last error: {p.lastError}</div>}
        </div>
      )}
    </Drawer>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="break-words font-medium text-heading">{value}</div>
    </div>
  );
}

function Settings({ data, reload }: { data: any; reload: () => Promise<void> }) {
  const { config, categories } = data;
  const [f, setF] = useState({
    targets: (config.targets || []).map((t: any) => ({ category: t.category, city: t.city, done: t.done, found: t.found })),
    dailyLimit: config.dailyLimit,
    followUpDays: (config.followUpDays || [3, 7]).join(", "),
    sendFromHour: config.sendFromHour,
    sendToHour: config.sendToHour,
    requireApproval: !!config.requireApproval,
    senderName: config.senderName || "",
    postalAddress: config.postalAddress || "",
    offer: config.offer || "",
    maxBounceRate: config.maxBounceRate,
  });
  const [newT, setNewT] = useState({ category: categories[0] || "restaurant", city: "" });
  const [saving, setSaving] = useState(false);
  const { notify } = useDialogs();
  const alert = useCallback((m: string) => notify(m, "error"), [notify]);

  async function save() {
    setSaving(true);
    try {
      await api("/api/outreach", "PUT", { ...f, followUpDays: String(f.followUpDays).split(/[,\s]+/).filter(Boolean).map(Number) });
      await reload();
      notify("Settings saved.", "success");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <CardHeader title="Who to contact" subtitle="Business type + city. Businesses are found on OpenStreetMap; chains are skipped. Each target is searched once, then the next one starts." />
        <div className="space-y-2 px-5 pb-5">
          {f.targets.map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              {t.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Search className="h-4 w-4 text-muted" />}
              <span className="flex-1 text-heading"><b>{t.category}</b> in {t.city}</span>
              <span className="text-xs text-muted">{t.done ? `${t.found || 0} found` : "waiting"}</span>
              <button className="text-muted hover:text-red-600" onClick={() => setF({ ...f, targets: f.targets.filter((_: any, j: number) => j !== i) })} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <select className="input w-auto" value={newT.category} onChange={(e) => setNewT({ ...newT, category: e.target.value })}>
              {categories.map((c: string) => <option key={c}>{c}</option>)}
            </select>
            <input className="input min-w-[180px] flex-1" placeholder="City, State (e.g. Houston, TX)" value={newT.city} onChange={(e) => setNewT({ ...newT, city: e.target.value })} />
            <button className="btn btn-outline" disabled={!newT.city.trim()} onClick={() => { setF({ ...f, targets: [...f.targets, { ...newT, city: newT.city.trim() }] }); setNewT({ ...newT, city: "" }); }}>
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <CardHeader title="Sending rules" subtitle="Times are US Central, weekdays only. Emails are spread out across the window." />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Max emails per day (all mailboxes)"><input type="number" className="input" value={f.dailyLimit} onChange={(e) => setF({ ...f, dailyLimit: e.target.value })} /></Field>
          <Field label="Send from (hour)"><input type="number" className="input" value={f.sendFromHour} onChange={(e) => setF({ ...f, sendFromHour: e.target.value })} /></Field>
          <Field label="Send until (hour)"><input type="number" className="input" value={f.sendToHour} onChange={(e) => setF({ ...f, sendToHour: e.target.value })} /></Field>
          <Field label="Follow-ups after (days)"><input className="input" value={f.followUpDays} onChange={(e) => setF({ ...f, followUpDays: e.target.value })} /></Field>
          <Field label="Auto-pause bounce rate (%)"><input type="number" className="input" value={f.maxBounceRate} onChange={(e) => setF({ ...f, maxBounceRate: e.target.value })} /></Field>
          <label className="flex items-center gap-2 pt-6 text-sm text-heading">
            <input type="checkbox" checked={f.requireApproval} onChange={(e) => setF({ ...f, requireApproval: e.target.checked })} />
            I approve each first email before it goes out
          </label>
        </div>
      </div>

      <div className="card">
        <CardHeader title="Sender and offer" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field label="Sender name (sign-off)"><input className="input" value={f.senderName} onChange={(e) => setF({ ...f, senderName: e.target.value })} /></Field>
          <Field label="Business postal address (required)"><input className="input" value={f.postalAddress} onChange={(e) => setF({ ...f, postalAddress: e.target.value })} /></Field>
          <Field label="Offer (used by the AI writer)" className="sm:col-span-2"><textarea className="input min-h-[80px]" value={f.offer} onChange={(e) => setF({ ...f, offer: e.target.value })} /></Field>
        </div>
        <div className="border-t border-line px-5 py-3">
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save settings
          </button>
        </div>
      </div>

      <Mailboxes data={data} reload={reload} />
    </div>
  );
}

function Mailboxes({ data, reload }: { data: any; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ provider: "google", email: "", fromName: "", password: "", smtpHost: "", smtpPort: "465", imapHost: "", imapPort: "993" });
  const [busy, setBusy] = useState("");
  const [tests, setTests] = useState<Record<string, any>>({});
  const { notify, confirm } = useDialogs();
  const alert = useCallback((m: string) => notify(m, "error"), [notify]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card">
      <CardHeader icon={ShieldCheck} title="Sending mailboxes" subtitle="Use a separate domain for cold email so your main domain stays safe. Each mailbox starts slow (warm-up) and sends more every day." />
      <div className="space-y-3 px-5 pb-5">
        {data.mailboxes.map((b: any) => {
          const t = tests[b._id];
          return (
            <div key={b._id} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Mail className="h-4 w-4 text-muted" />
                <b className="text-heading">{b.email}</b>
                <Pill text={b.active ? "Active" : "Paused"} style={b.active ? REPLY_STYLE.Interested : undefined} />
                <span className="text-xs text-muted">cap {b.dailyCap}/day · warm-up from {b.warmupStart} +{b.warmupStep}/day</span>
                <div className="ml-auto flex gap-2">
                  <button className="btn btn-sm btn-outline" disabled={!!busy} onClick={() => run("test" + b._id, async () => setTests({ ...tests, [b._id]: await api(`/api/outreach/mailboxes/${b._id}/test`, "POST") }))}>
                    {busy === "test" + b._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Test
                  </button>
                  <button className="btn btn-sm btn-outline" disabled={!!busy} onClick={() => run("act" + b._id, () => api(`/api/outreach/mailboxes/${b._id}`, "PUT", { active: !b.active }))}>{b.active ? "Pause" : "Activate"}</button>
                  <button className="btn btn-sm btn-ghost text-red-600" disabled={!!busy} onClick={async () => { if (await confirm({ title: `Remove ${b.email}?`, tone: "danger", confirmText: "Remove" })) run("del" + b._id, () => api(`/api/outreach/mailboxes/${b._id}`, "DELETE")); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {b.lastError && <div className="mt-2 text-xs text-red-600 dark:text-red-300">{b.lastError}</div>}
              {t && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <Check ok={t.login === "ok"} label={t.login === "ok" ? "Login works" : `Login failed: ${t.login}`} />
                  <Check ok={t.dns.spf} label="SPF" />
                  <Check ok={t.dns.dkim || t.dns.freeMail} label={t.dns.freeMail ? "DKIM (signed by provider)" : t.dns.dkim ? `DKIM (${t.dns.dkimSelector})` : "DKIM"} />
                  <Check ok={t.dns.dmarc} label="DMARC" />
                  {t.dns.freeMail && <span className="text-amber-700 dark:text-amber-300">Free mailbox: keep volume very low (about 20/day).</span>}
                </div>
              )}
            </div>
          );
        })}

        <div className="rounded-xl border border-dashed border-line p-4">
          <div className="mb-3 font-bold text-heading">Connect a mailbox</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider">
              <select className="input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                <option value="google">Google Workspace / Gmail</option>
                <option value="zoho">Zoho Mail</option>
                <option value="outlook">Microsoft 365 / Outlook</option>
                <option value="custom">Other (SMTP + IMAP)</option>
              </select>
            </Field>
            <Field label="Email address"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="From name"><input className="input" value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} /></Field>
            <Field label="App password"><input type="password" autoComplete="new-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            {form.provider === "custom" && (
              <>
                <Field label="SMTP server"><input className="input" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} /></Field>
                <Field label="SMTP port"><input className="input" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: e.target.value })} /></Field>
                <Field label="IMAP server"><input className="input" value={form.imapHost} onChange={(e) => setForm({ ...form, imapHost: e.target.value })} /></Field>
                <Field label="IMAP port"><input className="input" value={form.imapPort} onChange={(e) => setForm({ ...form, imapPort: e.target.value })} /></Field>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">Gmail / Google Workspace: turn on 2-step verification, then create an App password. The password is stored encrypted.</p>
          <button
            className="btn btn-primary mt-3"
            disabled={!!busy || !form.email || !form.password}
            onClick={() => run("add", async () => { await api("/api/outreach/mailboxes", "POST", form); setForm({ ...form, email: "", password: "" }); })}
          >
            {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Connect
          </button>
        </div>
      </div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300")}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {label}
    </span>
  );
}

const when = (d?: string | Date | null) => (d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-");
