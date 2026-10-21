"use client";

import { useState } from "react";
import { formatCompact, formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Tiny line for KPI cards. */
export function Sparkline({ values, className, stroke = "currentColor" }: { values: number[]; className?: string; stroke?: string }) {
  const W = 120;
  const H = 36;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * W, H - 3 - ((v - min) / (max - min || 1)) * (H - 6)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-9 w-28", className)} preserveAspectRatio="none" aria-hidden="true">
      <path d={smooth(pts, H - 3)} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Tiny bar group for KPI cards; the last bar is highlighted. */
export function MiniBars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className={cn("flex h-9 items-end gap-[3px]", className)} aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-[5px] rounded-full", i === values.length - 1 ? "bg-heading" : "bg-heading/25")}
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Catmull-Rom style smoothing into a cubic Bezier path. Control points never go below `floor`, so a flat-then-rise line does not dip under zero. */
function smooth(pts: number[][], floor = Infinity) {
  if (!pts.length) return "";
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0]! + (p2[0]! - p0[0]!) / 6, Math.min(floor, p1[1]! + (p2[1]! - p0[1]!) / 6)];
    const c2 = [p2[0]! - (p3[0]! - p1[0]!) / 6, Math.min(floor, p2[1]! - (p3[1]! - p1[1]!) / 6)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Smooth area chart with hover read-out (revenue over 12 months). */
export function AreaChart({ data, currency }: { data: { label: string; sub: string; value: number }[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 210;
  const padB = 26;
  const padT = 12;
  const max = Math.max(...data.map((d) => d.value), 1);
  const x = (i: number) => (i / Math.max(data.length - 1, 1)) * W;
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  const line = smooth(pts, H - padB);
  const last = data.length - 1;
  const active = hover ?? last;
  const a = data[active];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full overflow-visible" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="zx-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1="0" x2={W} y1={padT + t * (H - padT - padB)} y2={padT + t * (H - padT - padB)} className="stroke-line" strokeDasharray="4 6" />
        ))}
        <path d={`${line} L${W},${H - padB} L0,${H - padB} Z`} fill="url(#zx-area)" />
        <path d={line} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {pts[active] && (
          <>
            <line x1={pts[active]![0]} x2={pts[active]![0]} y1={padT} y2={H - padB} className="stroke-heading/20" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            <circle cx={pts[active]![0]} cy={pts[active]![1]} r="5" fill="#fff" stroke="#4f46e5" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {data.map((d, i) => (
          <rect key={i} x={x(i) - W / data.length / 2} y="0" width={W / data.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-0.5 text-[11px] text-muted">
        {data.map((d, i) => (
          <span key={i} className={cn(i === active && "font-semibold text-heading")}>
            {d.label}
          </span>
        ))}
      </div>
      {a && (
        <div
          className="pointer-events-none absolute -top-1 rounded-xl bg-surface px-3 py-1.5 text-xs shadow-[var(--card-shadow)] ring-1 ring-line"
          style={{ left: `clamp(0px, calc(${(active / Math.max(last, 1)) * 100}% - 48px), calc(100% - 110px))` }}
        >
          <div className="text-muted">{a.sub}</div>
          <div className="font-display text-sm font-bold text-heading">{formatMoney(a.value, currency)}</div>
        </div>
      )}
      <span className="sr-only">Peak {formatCompact(max)}</span>
    </div>
  );
}

/** Half-circle progress gauge (e.g. collected vs invoiced). */
export function Gauge({ percent, label }: { percent: number; label: string }) {
  const p = Math.max(0, Math.min(100, percent));
  const R = 80;
  const len = Math.PI * R;
  return (
    <div className="relative mx-auto w-full max-w-[220px]">
      <svg viewBox="0 0 200 110" className="w-full" aria-hidden="true">
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" className="stroke-surface-2" strokeWidth="22" strokeLinecap="butt" />
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="#4f46e5" strokeWidth="22" strokeDasharray={`${(p / 100) * len} ${len}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="font-display text-3xl font-bold text-heading">{Math.round(p)}%</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}
