"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : data.home || "/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input id="email" name="email" type="email" required autoComplete="email" className="input h-12 rounded-2xl pl-11 text-[15px]" placeholder="you@company.com" />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">
            Password
          </label>
          <button type="button" onClick={() => setForgot((f) => !f)} className="mb-1.5 text-xs font-semibold text-brand hover:underline dark:text-[#8f9bff]">
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            className="input h-12 rounded-2xl px-11 text-[15px]"
            placeholder="Your password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {forgot && (
          <p className="mt-2 rounded-xl bg-brand/5 px-3 py-2.5 text-xs leading-relaxed text-fg ring-1 ring-brand/15">
            No problem. Email{" "}
            <a href="mailto:support@zoxendigital.com?subject=Password%20reset" className="font-semibold text-brand hover:underline dark:text-[#8f9bff]">
              support@zoxendigital.com
            </a>{" "}
            or message your account manager, and we will send you a new sign-in link.
          </p>
        )}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-primary group h-12 w-full text-[15px]">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Sign in
        {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
    </form>
  );
}
