import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, MessageCircle, Rocket, ShieldCheck, Wallet } from "lucide-react";
import { currentUser } from "@/lib/session";
import { homeFor } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export const dynamic = "force-dynamic";

const PERKS = [
  { icon: MessageCircle, title: "One chat with your team", text: "Questions, files and approvals in one place, not lost in WhatsApp." },
  { icon: Rocket, title: "Live project progress", text: "See what is done, what is next and what we need from you." },
  { icon: Wallet, title: "Pay and sign online", text: "Invoices, proposals and contracts, ready when you are." },
];

export default async function LoginPage() {
  // Already signed in (e.g. the installed app reopening on its start page): go straight in.
  const user = await currentUser().catch(() => null);
  if (user) redirect(homeFor(user.role));

  return (
    <main className="flex min-h-screen bg-bg">
      {/* Brand side (laptops and up) */}
      <section className="relative hidden w-[52%] overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col xl:p-16">
        <div className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-brand/40 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-[380px] w-[380px] rounded-full bg-violet/40 blur-[120px]" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-60" aria-hidden="true">
          <defs>
            <linearGradient id="orbit" x1="0" x2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <ellipse cx="62%" cy="58%" rx="340" ry="110" fill="none" stroke="url(#orbit)" strokeWidth="1.2" transform="rotate(-18 600 500)" />
          <ellipse cx="62%" cy="58%" rx="460" ry="160" fill="none" stroke="url(#orbit)" strokeWidth="0.8" strokeOpacity="0.6" transform="rotate(-18 600 500)" />
        </svg>
        {/* subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />

        <div className="relative">
          {/* .paper keeps light colors here, so the logo text stays dark in dark mode too. */}
          <div className="paper inline-flex rounded-2xl bg-white px-4 py-2.5">
            <Logo />
          </div>
        </div>

        <div className="relative mt-auto max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Client &amp; team portal
          </span>
          <h2 className="mt-5 text-[40px] font-bold leading-[1.08] text-white xl:text-[48px]">
            Your projects, all in{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">one place.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/65">Track progress, chat with our team, approve work and pay invoices without the back and forth.</p>

          <ul className="mt-8 space-y-4">
            {PERKS.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <p.icon className="h-5 w-5 text-indigo-200" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{p.title}</span>
                  <span className="block text-sm text-white/55">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Floating preview cards */}
        <div className="pointer-events-none absolute right-10 top-24 hidden w-56 rounded-2xl bg-white/95 p-4 text-navy shadow-2xl xl:block" style={{ animation: "zx-float 6s ease-in-out infinite" }}>
          <div className="text-xs font-medium text-slate-500">Website redesign</div>
          <div className="font-display mt-1 text-2xl font-bold">72%</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-indigo-600 to-violet-500" />
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Design approved · building pages</div>
        </div>
        <div className="pointer-events-none absolute right-24 top-[248px] hidden items-center gap-2.5 rounded-2xl bg-white/95 px-3.5 py-2.5 text-navy shadow-2xl xl:flex" style={{ animation: "zx-float 7s ease-in-out 1.2s infinite" }}>
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <div>
            <div className="text-xs font-semibold">Invoice paid</div>
            <div className="text-[11px] text-slate-500">+$499 · just now</div>
          </div>
        </div>

        <div className="relative mt-10 flex items-center gap-2 text-xs text-white/45">
          <ShieldCheck className="h-4 w-4" /> Secure sign in · Your data stays private
        </div>
      </section>

      {/* Form side */}
      <section className="relative flex flex-1 flex-col px-5 py-8 sm:px-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl lg:hidden" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet/10 blur-3xl lg:hidden" />

        <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-[32px] font-bold leading-tight text-heading">Welcome back</h1>
          <p className="mt-2 text-[15px] text-muted">Sign in to see your projects, chat and invoices.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-8 text-center text-sm text-muted">
            New client? Your account is created by our team.{" "}
            <a href="mailto:support@zoxendigital.com" className="font-semibold text-brand hover:underline dark:text-[#8f9bff]">
              Get in touch
            </a>
          </p>
        </div>

        <nav className="relative mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <Link href="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-fg">
            Terms
          </Link>
          <Link href="/refund-policy" className="hover:text-fg">
            Refund Policy
          </Link>
          <Link href="/data-deletion" className="hover:text-fg">
            Data Deletion
          </Link>
        </nav>
      </section>
    </main>
  );
}
