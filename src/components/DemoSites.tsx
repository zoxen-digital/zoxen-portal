"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, ExternalLink, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { PageHeader } from "./ui";
import { useDialogs } from "./Dialogs";

type Site = { _id: string; url: string; name: string; industry: string; description: string; visible: boolean };

const DEMO_HOST = "https://demo.zoxendigital.com";
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Screenshot through the portal, kept in the browser cache for a week. */
const shot = (url: string) => `/api/demos/shot?u=${encodeURIComponent(url)}`;
const CACHE_KEY = "zx-demo-sites";

export function DemoSites() {
  const [items, setItems] = useState<Site[] | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [links, setLinks] = useState("");
  const [addIndustry, setAddIndustry] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { notify } = useDialogs();

  // Show the last saved list straight away, then refresh it from the server.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (saved?.items) {
        setItems((x) => x || saved.items);
        setIndustries((x) => (x.length ? x : saved.industries));
      }
    } catch {}
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Site[]; industries: string[] }>("/api/demos");
      setItems(r.items);
      setIndustries(r.industries);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(r));
      } catch {}
    } catch (e) {
      setItems((x) => x || []);
      notify((e as Error).message, "error");
    }
  }, [notify]);
  useEffect(() => {
    load();
  }, [load]);

  /** Sends links 20 at a time so each request stays well inside the server time limit. */
  async function add() {
    const urls = [...new Set(links.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
    if (!urls.length) return;
    setProgress({ done: 0, total: urls.length });
    let added = 0;
    let offline = 0;
    try {
      for (let i = 0; i < urls.length; i += 20) {
        const r = await api<{ added: number; offline: number }>("/api/demos", "POST", { urls: urls.slice(i, i + 20), industry: addIndustry || undefined });
        added += r.added;
        offline += r.offline;
        setProgress({ done: Math.min(urls.length, i + 20), total: urls.length });
      }
      setLinks("");
      notify(`${added} added${offline ? `, ${offline} not loading (kept hidden)` : ""}.`, "success");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setProgress(null);
      load();
    }
  }

  async function patch(s: Site, body: Partial<Site>) {
    setItems((x) => x && x.map((i) => (i._id === s._id ? { ...i, ...body } : i)));
    try {
      await api(`/api/demos/${s._id}`, "PATCH", body);
    } catch (e) {
      notify((e as Error).message, "error");
      load();
    }
  }

  async function remove(s: Site) {
    setItems((x) => x && x.filter((i) => i._id !== s._id));
    await api(`/api/demos/${s._id}`, "DELETE").catch((e) => notify(e.message, "error"));
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of items || []) c[s.industry] = (c[s.industry] || 0) + 1;
    return c;
  }, [items]);
  const shown = (items || []).filter((s) => (!filter || s.industry === filter) && (!q || `${s.name} ${s.url}`.toLowerCase().includes(q.toLowerCase())));
  const shareUrl = filter ? `${DEMO_HOST}/${slug(filter)}` : DEMO_HOST;

  return (
    <div>
      <PageHeader title="Demo Websites" subtitle={`Websites shown on ${DEMO_HOST.replace("https://", "")}. Share an industry link so a client only sees work from their field.`} />

      <div className="card mb-5 p-4">
        <span className="label">Add websites</span>
        <textarea className="input min-h-[90px]" placeholder={"Paste one or many links, one per line\nhttps://example.com"} value={links} onChange={(e) => setLinks(e.target.value)} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={addIndustry} onChange={(e) => setAddIndustry(e.target.value)}>
            <option value="">Industry: detect automatically</option>
            {industries.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={!!progress || !links.trim()} onClick={add}>
            {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {progress ? `Adding ${progress.done}/${progress.total}...` : "Add"}
          </button>
          <span className="text-xs text-muted">Name and industry are read from each site. You can change them below.</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All industries ({items?.length || 0})</option>
            {industries.filter((i) => counts[i]).map((i) => (
              <option key={i} value={i}>
                {i} ({counts[i]})
              </option>
            ))}
          </select>
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search name or link" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigator.clipboard.writeText(shareUrl).then(() => notify("Link copied: " + shareUrl, "success"))}
            title={shareUrl}
          >
            <Copy className="h-3.5 w-3.5" /> Copy {filter ? "industry" : "demo"} link
          </button>
        </div>

        {!items ? (
          <div className="flex justify-center p-10 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-muted">{items.length ? "No websites match." : "No websites yet. Paste links above."}</div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => (
              <div key={s._id} className={cn("overflow-hidden rounded-xl border border-line bg-surface", !s.visible && "opacity-60")}>
                <a href={s.url} target="_blank" rel="noreferrer" className="block aspect-[16/10] overflow-hidden bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot(s.url)} alt={s.name} loading="lazy" className="h-full w-full object-cover object-top" />
                </a>
                <div className="space-y-2 p-3">
                  <input className="w-full bg-transparent text-sm font-bold text-heading outline-none focus:underline" defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && patch(s, { name: e.target.value.trim() })} />
                  <div className="truncate text-xs text-muted">{s.url.replace("https://", "")}</div>
                  <div className="flex items-center gap-1.5">
                    <select className="input h-8 flex-1 py-0 text-xs" value={s.industry} onChange={(e) => patch(s, { industry: e.target.value })}>
                      {industries.map((i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </select>
                    <button onClick={() => patch(s, { visible: !s.visible })} title={s.visible ? "Shown on demo site (click to hide)" : "Hidden (click to show)"} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-heading">
                      {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <a href={s.url} target="_blank" rel="noreferrer" title="Open site" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-heading">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button onClick={() => remove(s)} title="Remove" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-red-500 hover:border-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
