"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package as PackageIcon, Pencil, Plus, Rocket } from "lucide-react";
import { api } from "@/lib/client-api";
import { SERVICES } from "@/lib/constants";
import { itemsTotal } from "@/lib/invoice-calc";
import { cn, formatMoney } from "@/lib/utils";
import { Modal } from "./Modal";
import { Field } from "./ui";
import { useDialogs } from "./Dialogs";
import { LineItemsEditor, linesPayload, toLines, type Lines } from "./LineItemsEditor";
import type { PackageT } from "@/lib/types";

export function PackageFormModal({ open, onClose, initial, currency }: { open: boolean; onClose: () => void; initial?: PackageT; currency: string }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", service: SERVICES[0]!, description: "", checklist: "", revisionLimit: "2", durationDays: "14", active: true });
  const [lines, setLines] = useState<Lines>(toLines(undefined, { currency }));

  useEffect(() => {
    if (!open) return;
    setF({
      name: initial?.name || "",
      service: initial?.service || SERVICES[0]!,
      description: initial?.description || "",
      checklist: (initial?.checklist || []).join("\n"),
      revisionLimit: String(initial?.revisionLimit ?? 2),
      durationDays: String(initial?.durationDays ?? 14),
      active: initial?.active ?? true,
    });
    setLines(toLines(initial, { currency }));
  }, [open, initial, currency]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { discountType: _d, discountValue: _v, taxPercent: _t, ...priced } = linesPayload(lines);
      const body = { ...f, ...priced, checklist: f.checklist.split("\n") };
      if (initial) await api(`/api/packages/${initial._id}`, "PUT", body);
      else await api("/api/packages", "POST", body);
      notify(initial ? "Package updated" : "Package created");
      onClose();
      router.refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit package" : "New package"} subtitle="A ready-made service you can sell in one click." size="xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Package name *">
            <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Business Website (5 pages)" />
          </Field>
          <Field label="Service">
            <select className="input" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
              {SERVICES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="What is included (client sees this)" className="sm:col-span-2">
            <textarea className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="5 pages, mobile responsive, contact form, basic SEO, 1 month support" />
          </Field>
          <Field label="Delivery time (days)">
            <input className="input" type="number" min="1" value={f.durationDays} onChange={(e) => setF({ ...f, durationDays: e.target.value })} />
          </Field>
          <Field label="Included revision rounds">
            <input className="input" type="number" min="0" value={f.revisionLimit} onChange={(e) => setF({ ...f, revisionLimit: e.target.value })} />
          </Field>
        </div>
        <div>
          <span className="label">Pricing</span>
          <LineItemsEditor value={lines} onChange={setLines} pricing={false} />
        </div>
        <Field label="Project checklist (one task per line)">
          <textarea className="input font-mono text-xs" rows={6} value={f.checklist} onChange={(e) => setF({ ...f, checklist: e.target.value })} placeholder={"Content and logo received\nDesign approved\nPages developed\nDomain connected"} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active (shown when starting a package)
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save package" : "Create package"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function NewPackageButton({ currency }: { currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus className="h-4 w-4" /> New package
      </button>
      <PackageFormModal open={open} onClose={() => setOpen(false)} currency={currency} />
    </>
  );
}

export function EditPackageButton({ pkg, currency }: { pkg: PackageT; currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-outline btn-sm">
        <Pencil className="h-4 w-4" /> Edit
      </button>
      <PackageFormModal open={open} onClose={() => setOpen(false)} initial={pkg} currency={currency} />
    </>
  );
}

/** On the client page: pick a package and either send a quote or start straight away. */
export function StartPackageButton({ clientId, packages }: { clientId: string; packages: PackageT[] }) {
  const router = useRouter();
  const { notify } = useDialogs();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState<"" | "quote" | "project">("");
  const pkg = packages.find((p) => p._id === pick);

  async function start(mode: "quote" | "project") {
    if (!pkg) return;
    setBusy(mode);
    try {
      const r = await api<{ quoteId?: string; projectId?: string }>(`/api/packages/${pkg._id}/start`, "POST", { client: clientId, mode });
      setOpen(false);
      if (mode === "quote") {
        notify("Draft quote created. Review it, then send it to the client.");
        router.push(`/quotes/${r.quoteId}`);
      } else {
        notify("Project and invoice created. The client was notified.");
        router.push(`/projects/${r.projectId}`);
      }
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-outline" disabled={!packages.length} title={packages.length ? undefined : "Create packages first"}>
        <PackageIcon className="h-4 w-4" /> Start a package
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Start a package" subtitle="Choose a package for this client." size="lg">
        <div className="space-y-2">
          {packages.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => setPick(p._id)}
              className={cn("w-full rounded-xl border p-4 text-left transition", pick === p._id ? "border-brand bg-brand/5" : "border-line hover:bg-surface-2")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-heading">{p.name}</div>
                <div className="font-bold text-heading">{formatMoney(itemsTotal(p.items), p.currency)}</div>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {p.service} · {p.durationDays} days · {p.revisionLimit} revision round{p.revisionLimit === 1 ? "" : "s"} · {p.checklist.length} checklist tasks
              </div>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={() => start("quote")} disabled={!pkg || !!busy} className="btn btn-outline">
            {busy === "quote" && <Loader2 className="h-4 w-4 animate-spin" />} Send a quote first
          </button>
          <button onClick={() => start("project")} disabled={!pkg || !!busy} className="btn btn-primary">
            {busy === "project" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Start now (project + invoice)
          </button>
        </div>
      </Modal>
    </>
  );
}
