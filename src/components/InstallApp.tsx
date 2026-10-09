"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const HIDE_KEY = "zx-install-hidden";
const SNOOZE_DAYS = 7;

function hiddenNow() {
  try {
    return Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * Registers the service worker and offers "Install app".
 * Android/desktop Chrome: real install prompt. iPhone Safari: short Share → Add to Home Screen steps.
 * Phones and tablets only. Hidden when already installed, and for 7 days after the user closes it.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (installed) return;
    // Phones and tablets only; on desktop the browser's own install icon is enough.
    if (!window.matchMedia("(pointer: coarse)").matches || window.innerWidth >= 1024) return;
    if (hiddenNow()) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (isIos) {
      setIos(true);
      setShow(true);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
      // Chrome fires this again on every page; respect "closed" until the snooze ends.
      if (!hiddenNow()) setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function hide() {
    setShow(false);
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000));
    } catch {}
  }

  async function install() {
    if (ios) return setSteps(true);
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-sm card p-4 shadow-xl sm:bottom-4 sm:right-4 sm:left-auto">
      <button onClick={hide} aria-label="Close" className="absolute right-2 top-2 rounded-lg p-1 text-muted hover:text-fg">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
        <div>
          <div className="font-semibold text-heading">Install the Zoxen app</div>
          <div className="text-xs text-muted">Open it from your home screen and get instant alerts.</div>
        </div>
      </div>
      {steps ? (
        <ol className="mt-3 space-y-1.5 text-sm text-fg">
          <li className="flex items-center gap-2">
            1. Tap <Share className="h-4 w-4 text-brand" /> <b>Share</b> at the bottom of Safari
          </li>
          <li>
            2. Choose <b>Add to Home Screen</b>
          </li>
          <li>
            3. Tap <b>Add</b>
          </li>
        </ol>
      ) : (
        <button onClick={install} className="btn btn-primary mt-3 w-full">
          <Download className="h-4 w-4" /> Install app
        </button>
      )}
    </div>
  );
}
