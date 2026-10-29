"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Globe, Loader2, MapPin, RotateCcw, Search, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { PageHeader } from "./ui";
import { useDialogs } from "./Dialogs";

type Row = { _id: string; name: string; phone: string; website: string; address: string; category: string; city: string; status: "new" | "done" | "no"; statusBy: string };
type Res = { items: Row[]; total: number; page: number; pageSize: number; counts: Record<string, number>; categories: string[] };

const TABS = [
  { key: "new", label: "To contact" },
  { key: "done", label: "Done" },
  { key: "no", label: "Not interested" },
  { key: "", label: "All" },
];

/** wa.me needs the number with country code and digits only; 10-digit numbers are US/Canada. */
function waLink(phone: string) {
  let d = phone.split(/[;,/]/)[0]!.replace(/\D/g, "");
  if (d.length === 10) d = "1" + d;
  return `https://wa.me/${d}`;
}

export function LeadFinder() {
  const [res, setRes] = useState<Res | null>(null);
  const [status, setStatus] = useState("new");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ category: "restaurant", city: "" });
  const [searching, setSearching] = useState(false);
  const { notify } = useDialogs();

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ status, q, page: String(page) });
    try {
      setRes(await api<Res>(`/api/finder?${sp}`));
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }, [status, q, page, notify]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function find() {
    setSearching(true);
    try {
      const r = await api<{ found: number; withPhone: number; added: number }>("/api/finder", "POST", form);
      notify(r.added ? `${r.added} new leads added (${r.withPhone} of ${r.found} had a number).` : r.found ? "No new leads: these were already in your list." : "Nothing found. Try another city or business type.", r.added ? "success" : "info");
      setStatus("new");
      setPage(1);
      await load();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSearching(false);
    }
  }

  async function mark(r: Row, next: Row["status"]) {
    setRes((x) => x && { ...x, items: x.items.map((i) => (i._id === r._id ? { ...i, status: next } : i)) });
    try {
      await api(`/api/finder/${r._id}`, "PATCH", { status: next });
    } catch (e) {
      notify((e as Error).message, "error");
    }
    load();
  }

  const counts = res?.counts || {};
  const all = (counts.new || 0) + (counts.done || 0) + (counts.no || 0);

  return (
    <div>
      <PageHeader title="Lead Finder" subtitle="Find local businesses with a phone number. Tap a number to open WhatsApp, then tick or cross it." />

      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[160px]">
            <span className="label">Business type</span>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {(res?.categories || ["restaurant"]).map((c) => (
                <option key={c} value={c}>
                  {c[0]!.toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[200px] flex-1">
            <span className="label">City</span>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input pl-9" placeholder="e.g. Houston, TX" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} onKeyDown={(e) => e.key === "Enter" && form.city.trim() && !searching && find()} />
            </div>
          </label>
          <button className="btn btn-primary" disabled={searching || !form.city.trim()} onClick={find}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} {searching ? "Finding..." : "Find leads"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const n = t.key ? counts[t.key] || 0 : all;
              return (
                <button
                  key={t.key}
                  onClick={() => { setStatus(t.key); setPage(1); }}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", status === t.key ? "bg-brand text-white" : "bg-surface-2 text-muted hover:text-heading")}
                >
                  {t.label} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search name, number, city" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
        </div>

        {!res ? (
          <div className="flex justify-center p-10 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : res.items.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-muted">{all ? "Nothing here." : "No leads yet. Choose a business type and city above, then press Find leads."}</div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {res.items.map((r) => (
                <li key={r._id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap", r.status !== "new" && "bg-surface-2/40")}>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm font-semibold", r.status === "no" ? "text-muted line-through" : "text-heading")}>{r.name}</div>
                    <div className="truncate text-xs text-muted">
                      {r.category} · {r.city}
                      {r.statusBy && r.status !== "new" ? ` · ${r.status === "done" ? "done" : "crossed"} by ${r.statusBy}` : ""}
                    </div>
                  </div>
                  <a href={waLink(r.phone)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300" title="Open in WhatsApp">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
                    </svg>
                    {r.phone.split(/[;,/]/)[0]}
                  </a>
                  {r.website ? (
                    <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline dark:text-[#8f9bff]" title={r.website}>
                      <Globe className="h-3.5 w-3.5" /> Website
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">No website</span>
                  )}
                  <div className="flex shrink-0 gap-1.5">
                    {r.status === "new" ? (
                      <>
                        <button onClick={() => mark(r, "done")} title="Done" aria-label="Mark done" className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </button>
                        <button onClick={() => mark(r, "no")} title="Not interested" aria-label="Mark not interested" className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-red-500 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                          <X className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white", r.status === "done" ? "bg-emerald-500" : "bg-red-500")}>
                          {r.status === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
                        </span>
                        <button onClick={() => mark(r, "new")} title="Undo" aria-label="Undo" className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:text-heading">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
              <span>{res.total} leads</span>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <button className="btn btn-sm btn-outline" disabled={page * res.pageSize >= res.total} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
