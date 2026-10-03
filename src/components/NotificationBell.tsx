"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, Loader2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { useDialogs } from "./Dialogs";
import { LIVE_EVENT } from "./LiveUpdates";
import type { NotificationT } from "@/lib/types";

const POLL_MS = 60_000;

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

/** In-app notifications with unread count, refreshed every minute and when the tab regains focus. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationT[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: NotificationT[]; unread: number }>("/api/notifications");
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Offline or signed out: keep what we have.
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(LIVE_EVENT, load);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(LIVE_EVENT, load);
      document.removeEventListener("mousedown", onClick);
    };
  }, [load]);

  async function openItem(n: NotificationT) {
    setOpen(false);
    if (!n.read) {
      setItems((xs) => xs.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api("/api/notifications", "PUT", { id: n._id }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await api("/api/notifications", "PUT", { all: true }).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative btn btn-ghost px-2.5" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-2 w-[min(92vw,380px)] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="font-bold text-heading">Notifications</div>
            {unread > 0 && (
              <button onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline dark:text-[#8f9bff]">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted">You are all caught up.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => openItem(n)}
                  className={cn("flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface-2", !n.read && "bg-brand/5")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-heading">{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-line p-2">
            <PushToggle compact />
          </div>
        </div>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type PushState = "unsupported" | "off" | "on" | "denied" | "loading";

/** Turns phone / desktop push notifications on or off for this device. */
export function PushToggle({ compact }: { compact?: boolean }) {
  const { notify } = useDialogs();
  const [state, setState] = useState<PushState>("loading");
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [key]);

  async function enable() {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key!) }));
      await api("/api/push", "POST", sub.toJSON());
      setState("on");
      notify("Notifications turned on for this device");
    } catch (e) {
      setState("off");
      notify((e as Error).message || "Could not turn on notifications", "error");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push", "DELETE", { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }

  if (state === "unsupported") {
    return compact ? null : <p className="text-xs text-muted">Push notifications are not available in this browser. On iPhone, add this site to your Home Screen first.</p>;
  }
  if (state === "denied") {
    return <p className="px-2 py-1 text-xs text-muted">Notifications are blocked for this site. Allow them in your browser settings to get alerts.</p>;
  }
  return (
    <button
      onClick={state === "on" ? disable : enable}
      disabled={state === "loading"}
      className={cn("btn w-full", compact ? "btn-ghost btn-sm justify-start" : state === "on" ? "btn-outline" : "btn-primary")}
    >
      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
      {state === "on" ? "Phone / desktop alerts are on (turn off)" : "Turn on phone / desktop alerts"}
    </button>
  );
}
