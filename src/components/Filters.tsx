import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Server-rendered status tabs that keep the other query params. */
export function StatusTabs({
  basePath,
  current,
  options,
  params,
  counts,
}: {
  basePath: string;
  current?: string;
  options: string[];
  params: Record<string, string | undefined>;
  counts?: Record<string, number>;
}) {
  const href = (status?: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "status") sp.set(k, v);
    if (status) sp.set("status", status);
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const all = ["All", ...options];
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {all.map((o) => {
        const active = (o === "All" && !current) || o === current;
        return (
          <Link
            key={o}
            href={href(o === "All" ? undefined : o)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active ? "bg-brand-gradient text-white shadow" : "text-muted hover:bg-surface-2 hover:text-fg"
            )}
          >
            {o}
            {counts && counts[o] !== undefined && (
              <span className={cn("rounded-full px-1.5 text-[11px]", active ? "bg-white/20" : "bg-surface-2")}>{counts[o]}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function SearchBox({
  action,
  defaultValue,
  placeholder,
  hidden,
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} className="relative w-full sm:w-72">
      {hidden &&
        Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input name="q" defaultValue={defaultValue} className="input pl-9" placeholder={placeholder} />
    </form>
  );
}
