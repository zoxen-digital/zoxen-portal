"use client";

import { useEffect, useRef } from "react";

/**
 * Makes a chat fill the screen from its top edge down to the bottom (or the phone tab bar),
 * and stops the page itself from scrolling, so only the message list scrolls, like WhatsApp.
 * Follows the on-screen keyboard on phones via visualViewport.
 */
export function useFillHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    const fit = () => {
      const nav = document.querySelector<HTMLElement>("[data-bottom-nav]");
      const navH = nav && getComputedStyle(nav).display !== "none" ? nav.offsetHeight : 0;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      // With the keyboard open the tab bar is covered, so do not reserve space for it.
      const keyboard = window.innerHeight - vh > 120;
      const top = el.getBoundingClientRect().top;
      el.style.height = `${Math.max(320, vh - top - (keyboard ? 0 : navH))}px`;
    };
    fit();
    const raf = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      html.style.overflow = prev[0]!;
      document.body.style.overflow = prev[1]!;
    };
  }, []);
  return ref;
}
