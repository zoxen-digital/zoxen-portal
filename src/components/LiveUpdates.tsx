"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 15_000;

/** Fired on window when fresh data arrived, so widgets like the bell can reload too. */
export const LIVE_EVENT = "zx:live";

/**
 * Keeps the page up to date without a manual refresh: checks a small change stamp
 * every 15 seconds (only while the tab is visible) and re-renders the page data when it moves.
 * Form inputs keep what the user typed, because a refresh keeps client state.
 */
export function LiveUpdates() {
  const router = useRouter();
  const last = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    async function check() {
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) return;
        const { stamp } = (await res.json()) as { stamp: number };
        if (last.current !== null && stamp !== last.current) {
          router.refresh();
          window.dispatchEvent(new Event(LIVE_EVENT));
        }
        last.current = stamp;
      } catch {
        // Offline for a moment: try again next tick.
      } finally {
        busy.current = false;
      }
    }

    check();
    const t = setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  return null;
}
