"use client";

import { useState } from "react";
import { formatCompact, formatMoney } from "@/lib/utils";

export function BarChart({
  data,
  currency,
  height = 260,
}: {
  data: { label: string; sub?: string; value: number }[];
  currency: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const niceMax = niceCeil(max || 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * niceMax);
  const peak = data.findIndex((d) => d.value === max && max > 0);
  const active = hover ?? peak;

  const W = 720;
  const H = height;
  const padL = 48;
  const padB = 28;
  const padT = 16;
  const chartW = W - padL - 8;
  const chartH = H - padB - padT;
  const slot = chartW / Math.max(data.length, 1);
  const barW = Math.min(36, slot * 0.58);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="barSoft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2639E8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2639E8" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="barActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C3BF5" />
            <stop offset="100%" stopColor="#2639E8" />
          </linearGradient>
        </defs>
        {ticks.map((t) => {
          const y = padT + chartH - (t / niceMax) * chartH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y} y2={y} stroke="var(--line)" strokeDasharray="4 4" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {formatCompact(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = niceMax ? (d.value / niceMax) * chartH : 0;
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + chartH - h;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} className="cursor-pointer">
              <rect x={padL + slot * i} y={padT} width={slot} height={chartH} fill="transparent" />
              <rect x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 3 : 0)} rx="6" fill={i === active ? "url(#barActive)" : "url(#barSoft)"} />
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {active >= 0 && data[active] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 shadow-lg"
          style={{
            left: `${((padL + slot * active + slot / 2) / W) * 100}%`,
            top: `${Math.max(0, ((padT + chartH - (data[active].value / niceMax) * chartH) / H) * 100 - 26)}%`,
          }}
        >
          <div className="text-[11px] text-muted">{data[active].sub || data[active].label}</div>
          <div className="flex items-center gap-1.5 text-sm font-bold text-heading">
            <span className="h-2 w-2 rounded-full bg-violet" />
            {formatMoney(data[active].value, currency)}
          </div>
        </div>
      )}
    </div>
  );
}

function niceCeil(n: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export function Donut({
  segments,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around xl:flex-col 2xl:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle cx="90" cy="90" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="22" />
          {total > 0 &&
            segments.map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx="90"
                  cy="90"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="22"
                  strokeDasharray={`${Math.max(len - 2, 0)} ${c}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-heading">{total}</div>
          <div className="text-xs text-muted">{centerLabel}</div>
        </div>
      </div>
      <ul className="w-full max-w-[240px] space-y-3">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 text-fg">{s.label}</span>
            <span className="w-8 text-right font-semibold text-heading">{s.value}</span>
            <span className="w-10 text-right text-xs text-muted">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
