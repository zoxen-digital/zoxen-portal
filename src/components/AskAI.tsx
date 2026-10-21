"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "model"; text: string; about?: string[] };

const KEY = "zx-ask-ai";
export const ASK_AI_EVENT = "zx:ask-ai";

/** Header button that opens the panel. */
export function AskAIButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(ASK_AI_EVENT))}
      className="flex h-10 items-center gap-2 rounded-full bg-navy px-3 text-sm font-semibold text-white shadow-lg shadow-navy/20 transition hover:scale-[1.03] dark:bg-white dark:text-navy sm:px-4"
      title="Ask AI (Ctrl+J)"
      aria-label="Ask AI"
    >
      <Sparkles className="h-4 w-4" /> <span className="hidden md:inline">Ask AI</span>
    </button>
  );
}

const STARTERS = [
  "What needs my attention today?",
  "Which clients are waiting for a reply?",
  "Which invoices are unpaid?",
  "Give me a report on ",
];

/** **bold**, bullet lines and line breaks from the AI answer. */
function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const body = line.replace(/^\s*[-*•]\s+/, "");
        const parts = body.split(/(\*\*[^*]+\*\*)/g).map((p, k) => (p.startsWith("**") && p.endsWith("**") ? <b key={k}>{p.slice(2, -2)}</b> : <span key={k}>{p}</span>));
        if (!line.trim()) return <div key={i} className="h-1" />;
        return bullet ? (
          <div key={i} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            <span>{parts}</span>
          </div>
        ) : (
          <p key={i}>{parts}</p>
        );
      })}
    </div>
  );
}

/** "Ask AI" side panel (opened from the header button or Ctrl+J): ask about any client or the agency in plain words. */
export function AskAI() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(ASK_AI_EVENT, show);
    return () => window.removeEventListener(ASK_AI_EVENT, show);
  }, []);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) setTurns(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-20)));
    } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(text?: string) {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    const history = turns.map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await api<{ answer: string; about: string[] }>("/api/ai/ask", "POST", { question, history });
      setTurns((t) => [...t, { role: "model", text: r.answer, about: r.about }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "model", text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-0" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-2xl sm:inset-y-3 sm:right-3 sm:rounded-[28px]" style={{ animation: "zx-slide-in .25s ease-out" }}>
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold text-heading">Zoxen AI</div>
                <div className="text-xs text-muted">Ask about any client, project or invoice</div>
              </div>
              {turns.length > 0 && (
                <button onClick={() => setTurns([])} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-fg" title="New chat" aria-label="New chat">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {turns.length === 0 ? (
                <div className="pt-6">
                  <div className="font-display text-xl font-bold text-heading">How can I help?</div>
                  <p className="mt-1 text-sm text-muted">Type a client name to get their full status: projects, payments, chat and what to do next. English or Roman Urdu both work.</p>
                  <div className="mt-5 grid gap-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => (s.endsWith(" ") ? (setQ(s), inputRef.current?.focus()) : ask(s))}
                        className="rounded-2xl border border-line px-4 py-3 text-left text-sm text-fg transition hover:border-brand hover:bg-brand/5"
                      >
                        {s.endsWith(" ") ? `${s}[client name]...` : s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                turns.map((t, i) =>
                  t.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-navy px-4 py-2.5 text-sm text-white dark:bg-white dark:text-navy">{t.text}</div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:text-[#8f9bff]">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 text-sm leading-relaxed text-fg">
                        <Rich text={t.text} />
                        {t.about && t.about.length > 0 && <div className="mt-2 text-[11px] text-muted">Based on: {t.about.join(", ")}</div>}
                      </div>
                    </div>
                  )
                )
              )}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking the portal...
                </div>
              )}
            </div>

            <div className="border-t border-line p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2/50 p-1.5 focus-within:border-brand">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask();
                    }
                  }}
                  placeholder="e.g. Acme Co ki report do"
                  className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm outline-none"
                />
                <button onClick={() => ask()} disabled={busy || !q.trim()} className="btn btn-primary h-10 w-10 shrink-0 rounded-full p-0" aria-label="Send">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-muted">AI can make mistakes. Answers use portal data only; emails and phone numbers are never sent to the AI.</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
