import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" x2="1">
            <stop offset="0%" stopColor="#2639E8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6C3BF5" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <ellipse cx="15%" cy="20%" rx="380" ry="120" fill="none" stroke="url(#lg)" transform="rotate(-18)" />
        <ellipse cx="90%" cy="85%" rx="420" ry="140" fill="none" stroke="url(#lg)" />
      </svg>
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet/10 blur-3xl" />

      <div className="card relative w-full max-w-md p-8 shadow-xl shadow-brand/5">
        <Logo className="mb-8" />
        <h1 className="text-2xl font-bold text-heading">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your projects, invoices and updates.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
