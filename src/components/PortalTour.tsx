"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pause, Play, X } from "lucide-react";

/**
 * Auto-playing walkthrough for clients: the screen dims, a spotlight glides from item to item,
 * an animated pointer "clicks" each one and a short caption types out above it. It moves on by itself,
 * opens the right page when needed, and plays once per device (Replay from the menu).
 */

type Step = {
  /** data-tour value of the element to highlight; none = centered card. */
  target?: string;
  /** Page to open before this step. */
  path?: string;
  title: string;
  text: string;
};

const STEPS: Step[] = [
  { title: "Welcome to your portal 👋", text: "Here is a 30-second tour of where everything is. Sit back, it plays by itself." },
  { target: "/portal/chat", path: "/portal/chat", title: "Chat with us", text: "This is your direct line to our team. Ask anything, share feedback or send files here." },
  { target: "chat-input", path: "/portal/chat", title: "Type your message", text: "Write here and press send. You can attach images, PDFs and other files too." },
  { target: "/portal", path: "/portal", title: "Your projects", text: "See every project, its progress and what we need from you, all in one place." },
  { target: "/portal/invoices", path: "/portal/invoices", title: "Invoices", text: "View and pay your invoices online. Receipts stay here for your records." },
  { target: "/portal/documents", path: "/portal/documents", title: "Proposals & contracts", text: "Review quotes and sign contracts online, no printing needed." },
  { target: "bell", title: "Never miss an update", text: "Tap the bell and turn on alerts to get a notification the moment we reply or need your approval." },
  { target: "account", title: "Your account", text: "Change your password and details here, or replay this tour anytime." },
  { title: "You're all set! 🎉", text: "Start with a message in Chat. We're happy to help." },
];

const STEP_MS = 5200;
const SEEN_KEY = "zx-tour-seen";
export const TOUR_EVENT = "zx:tour";

/** Starts the tour from anywhere (e.g. a "Replay tour" button). */
export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

/** The visible element for a data-tour key (desktop sidebar and phone tab bar both carry it). */
function findTarget(key: string) {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`));
  return all.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  });
}

type Box = { x: number; y: number; w: number; h: number };

export function PortalTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [paused, setPaused] = useState(false);
  const [typed, setTyped] = useState("");
  const [clicking, setClicking] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const step = STEPS[i]!;

  const finish = useCallback(() => {
    setOn(false);
    setBox(null);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  // First visit: start after the page settles. Replay: listen for the event.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    const t = seen ? null : window.setTimeout(() => (setI(0), setOn(true)), 900);
    const replay = () => {
      setI(0);
      setPaused(false);
      setOn(true);
    };
    window.addEventListener(TOUR_EVENT, replay);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener(TOUR_EVENT, replay);
    };
  }, []);

  // Each step: open its page, wait for the element, then move the spotlight and pointer there.
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    setTyped("");
    setClicking(false);
    setProgress(0);
    if (step.path && pathname !== step.path) router.push(step.path);
    if (!step.target) {
      setBox(null);
      return;
    }
    const started = Date.now();
    const locate = () => {
      if (cancelled) return;
      const el = findTarget(step.target!);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        const r = el.getBoundingClientRect();
        const pad = 8;
        setBox({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 });
        window.setTimeout(() => !cancelled && setClicking(true), 700);
      } else if (Date.now() - started < 4000) window.setTimeout(locate, 120);
      else setBox(null); // Element not on this screen: show the caption in the middle.
    };
    locate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, i]);

  // Keep the spotlight on its element when the window resizes.
  useEffect(() => {
    if (!on || !step.target) return;
    const onResize = () => {
      const el = findTarget(step.target!);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [on, step.target]);

  // Typewriter caption.
  useEffect(() => {
    if (!on) return;
    let n = 0;
    const t = window.setInterval(() => {
      n += 2;
      setTyped(step.text.slice(0, n));
      if (n >= step.text.length) clearInterval(t);
    }, 22);
    return () => clearInterval(t);
  }, [on, i, step.text]);

  // Auto-advance with a progress bar (pausable).
  useEffect(() => {
    if (!on || paused) return;
    const tick = 50;
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        const next = p + tick / STEP_MS;
        if (next >= 1) {
          if (i >= STEPS.length - 1) finish();
          else setI((x) => x + 1);
          return 0;
        }
        return next;
      });
    }, tick);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [on, paused, i, finish]);

  // Esc closes, arrows step.
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((x) => Math.min(STEPS.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === " ") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, finish]);

  if (!on) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(340, vw - 32);
  // Caption sits above the spotlight, or below it when there is no room above.
  let cardStyle: React.CSSProperties;
  if (box) {
    const above = box.y > 190;
    const left = Math.max(16, Math.min(vw - cardW - 16, box.x + box.w / 2 - cardW / 2));
    cardStyle = above ? { left, top: box.y - 14, transform: "translateY(-100%)", width: cardW } : { left, top: Math.min(vh - 200, box.y + box.h + 14), width: cardW };
  } else {
    cardStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: Math.min(400, vw - 32) };
  }
  const pointer = box ? { left: box.x + box.w * 0.62, top: box.y + box.h * 0.62 } : { left: vw / 2 + 60, top: vh / 2 + 90 };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Portal tour">
      {/* Dim layer with a moving spotlight hole (the huge shadow darkens everything around it). */}
      <div
        className="pointer-events-none absolute rounded-2xl transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={
          box
            ? { left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: "0 0 0 9999px rgba(8,12,28,0.62), 0 0 0 3px rgba(129,140,248,0.9), 0 0 40px 6px rgba(99,102,241,0.55)" }
            : { left: vw / 2, top: vh / 2, width: 0, height: 0, boxShadow: "0 0 0 9999px rgba(8,12,28,0.62)" }
        }
      />
      {/* Block clicks on the page while the tour plays. */}
      <div className="absolute inset-0" onClick={() => setPaused((p) => !p)} />

      {/* Animated pointer that glides to each item and "clicks" it. */}
      <div className={`pointer-events-none absolute transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${box ? "opacity-100" : "opacity-0"}`} style={pointer}>
        {clicking && box && <span className="absolute -left-4 -top-4 h-8 w-8 rounded-full border-2 border-white/80" style={{ animation: "zx-ripple 1s ease-out infinite" }} />}
        <svg width="30" height="30" viewBox="0 0 24 24" className={clicking ? "scale-90 transition-transform" : "transition-transform"} style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,.4))" }}>
          <path d="M5 3l14 7.5-6 1.6-2.6 5.9z" fill="#fff" stroke="#0b1020" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Caption */}
      <div key={i} className="absolute rounded-2xl bg-surface p-4 text-left shadow-2xl ring-1 ring-white/10 transition-all duration-500" style={{ ...cardStyle, animation: "zx-pop .35s ease-out" }}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand dark:text-[#8f9bff]">
            Step {i + 1} of {STEPS.length}
          </span>
          <button onClick={finish} className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close tour">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="font-display text-base font-bold text-heading">{step.title}</div>
        <p className="mt-1 min-h-[3.75rem] text-sm leading-relaxed text-fg">
          {typed}
          {typed.length < step.text.length && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-brand" />}
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${((i + progress) / STEPS.length) * 100}%`, transition: "width 60ms linear" }} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => setPaused((p) => !p)} className="btn btn-ghost btn-sm px-2.5">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? "Play" : "Pause"}
          </button>
          <div className="flex gap-1.5">
            {i < STEPS.length - 1 && (
              <button onClick={finish} className="btn btn-ghost btn-sm">
                Skip
              </button>
            )}
            <button onClick={() => (i >= STEPS.length - 1 ? finish() : setI(i + 1))} className="btn btn-primary btn-sm">
              {i >= STEPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
