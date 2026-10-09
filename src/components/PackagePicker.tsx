"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { api } from "@/lib/client-api";
import { formatMoney } from "@/lib/utils";

type PkgItem = { description: string; details?: string; qty: number; unit?: string; rate: number };
type Pkg = { _id: string; name: string; service?: string; currency: string; items: PkgItem[]; active: boolean };
export type PickedLine = { description: string; details: string; qty: string; unit: string; rate: string };

/** "Add package / add-on": appends a package's items (e.g. AI Chatbot on top of a website) to a quote or invoice. */
export function PackagePicker({ onPick }: { onPick: (lines: PickedLine[], pkg: { name: string; currency: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Pkg[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && list === null) api<Pkg[]>("/api/packages").then((l) => setList(l.filter((p) => p.active))).catch(() => setList([]));
  }, [open, list]);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const total = (p: Pkg) => p.items.reduce((s, i) => s + i.qty * i.rate, 0);

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-outline btn-sm">
        <Package className="h-4 w-4" /> Add package / add-on
      </button>
      {open && (
        <div className="card absolute left-0 z-30 mt-2 max-h-80 w-80 overflow-y-auto p-1 shadow-xl">
          {list === null ? (
            <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin text-muted" />
          ) : list.length === 0 ? (
            <p className="p-3 text-sm text-muted">No packages yet. Create them under Invoices & Billing → Packages.</p>
          ) : (
            list.map((p) => (
              <button
                type="button"
                key={p._id}
                onClick={() => {
                  onPick(
                    p.items.map((i) => ({ description: i.description, details: i.details || "", qty: String(i.qty), unit: i.unit || "", rate: String(i.rate) })),
                    { name: p.name, currency: p.currency }
                  );
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-heading">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{p.items.length} item{p.items.length === 1 ? "" : "s"}{p.service ? ` · ${p.service}` : ""}</span>
                </span>
                <span className="shrink-0 text-xs font-bold">{formatMoney(total(p), p.currency)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
