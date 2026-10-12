import Link from "next/link";
import { Logo } from "./Logo";
import { COMPANY, LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { cn } from "@/lib/utils";

/** Public legal page (no sign-in needed), shared layout for Privacy, Terms, Refund and Data Deletion. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <a href={COMPANY.website}>
            <Logo />
          </a>
          <Link href="/login" className="text-sm font-semibold text-muted hover:text-fg">
            Client login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <nav className="mb-8 flex flex-wrap gap-2">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", d.slug === doc.slug ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted hover:text-fg")}
            >
              {d.title}
            </Link>
          ))}
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {COMPANY.updated}</p>
        <p className="mt-4 text-base text-fg">{doc.summary}</p>

        <div className="mt-8 space-y-8">
          {doc.sections.map((s, i) => (
            <section key={s.h} id={s.h.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
              <h2 className="mb-3 text-lg font-bold text-heading">
                {i + 1}. {s.h}
              </h2>
              <div className="space-y-3 text-[15px] leading-relaxed text-fg">
                {s.p?.map((t) => <p key={t}>{t}</p>)}
                {s.list && (
                  <ul className="list-disc space-y-1.5 pl-5 marker:text-brand">
                    {s.list.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                {s.after?.map((t) => <p key={t}>{t}</p>)}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © {new Date().getFullYear()} {COMPANY.name} · {COMPANY.email}
          </span>
          <span className="flex flex-wrap gap-3">
            {LEGAL_DOCS.map((d) => (
              <Link key={d.slug} href={`/${d.slug}`} className="hover:text-fg">
                {d.title}
              </Link>
            ))}
          </span>
        </div>
      </footer>
    </div>
  );
}
