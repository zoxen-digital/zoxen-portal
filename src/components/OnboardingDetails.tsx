import { FileText, ImageIcon } from "lucide-react";
import { OB_SECTIONS, packagePrice, type OnboardingAnswers } from "@/lib/onboarding-form";
import type { OnboardingT } from "@/lib/types";

/** Every answer of an onboarding form, grouped like the form. Works for old external submissions too. */
export function OnboardingDetails({ item }: { item: OnboardingT }) {
  const a = (item.data || {}) as Partial<OnboardingAnswers>;
  const portal = item.source === "portal";

  if (!portal) {
    const known = ["name", "email", "phone", "company", "website", "services", "budget", "message"];
    const rows: [string, unknown][] = [
      ["Name", item.name],
      ["Email", item.email],
      ["Phone", item.phone],
      ["Company", item.company],
      ["Website", item.website],
      ["Services", item.services?.join(", ")],
      ["Budget", item.budget],
      ["Message", item.message],
      ...Object.entries(item.data || {}).filter(([k]) => !known.includes(k)),
    ];
    return (
      <dl className="divide-y divide-line">
        {rows
          .filter(([, v]) => v !== undefined && v !== null && String(v).trim())
          .map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[180px_1fr]">
              <dt className="text-muted">{k}</dt>
              <dd className="whitespace-pre-wrap break-words text-fg">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
      </dl>
    );
  }

  const show = (key: keyof OnboardingAnswers) => {
    const v = a[key];
    if (Array.isArray(v)) return v.length ? v.join(", ") : "";
    if (key === "package" && v) return `${v} (${packagePrice(String(v))})`;
    return typeof v === "string" ? v : "";
  };

  return (
    <div className="space-y-6">
      {OB_SECTIONS.map((s) => {
        const rows = s.fields.map(([k, label]) => [label, show(k)] as const).filter(([, v]) => v);
        if (!rows.length) return null;
        return (
          <section key={s.title}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand dark:text-[#8f9bff]">{s.title}</h3>
            <dl className="divide-y divide-line">
              {rows.map(([label, v]) => (
                <div key={label} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[200px_1fr]">
                  <dt className="text-muted">{label}</dt>
                  <dd className="whitespace-pre-wrap break-words font-medium text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      {(a.logoUrl || a.attachmentUrls?.length) && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brand dark:text-[#8f9bff]">Files</h3>
          <div className="flex flex-wrap gap-3">
            {a.logoUrl && (
              <a href={a.logoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-line p-2 pr-3 text-sm hover:bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.logoUrl} alt="Logo" className="h-10 w-10 rounded-lg bg-white object-contain p-1" />
                <span className="flex items-center gap-1 font-medium">
                  <ImageIcon className="h-3.5 w-3.5" /> Logo
                </span>
              </a>
            )}
            {a.attachmentUrls?.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2">
                <FileText className="h-4 w-4 text-muted" /> File {i + 1}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
