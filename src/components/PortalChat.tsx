"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";
import { AttachmentList, AttachmentPicker } from "./FileUpload";
import { useDialogs } from "./Dialogs";
import type { AttachmentT } from "@/lib/types";

type Msg = { _id: string; authorName: string; authorRole: string; body: string; attachments: AttachmentT[]; createdAt: string };

function dayLabel(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === new Date(t.getTime() - 86_400_000).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === t.getFullYear() ? undefined : "numeric" });
}

/** The client's one chat with the agency, WhatsApp style. */
export function PortalChat({ companyName }: { companyName: string }) {
  const { notify } = useDialogs();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<AttachmentT[]>([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: Msg[] }>("/api/portal/chat");
      setMessages(r.messages);
    } catch {
      setMessages((m) => m ?? []);
    }
  }, []);

  useEffect(() => {
    // Opening the chat marks it read, so refresh the menu badge afterwards.
    load().then(() => router.refresh());
    const t = setInterval(() => document.visibilityState === "visible" && load(), 4000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, router]);

  useEffect(() => {
    if (!messages || messages.length === count.current) return;
    count.current = messages.length;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    if (sending || (!body.trim() && !files.length)) return;
    setSending(true);
    try {
      const m = await api<Msg>("/api/portal/chat", "POST", { body, attachments: files });
      setMessages((xs) => [...(xs || []), m]);
      setBody("");
      setFiles([]);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  let lastDay = "";
  return (
    <div className="card flex h-[calc(100dvh-10.5rem)] min-h-[420px] flex-col overflow-hidden lg:h-[calc(100dvh-7.5rem)]">
      <header className="flex items-center gap-3 border-b border-line p-3 sm:p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy">
          <LogoMark className="h-6 w-auto" id="zx-chat" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold text-heading">{companyName}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> We usually reply within working hours
          </div>
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-surface-2/40 p-3 sm:p-4">
        {messages === null ? (
          <div className="flex justify-center py-10 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto mt-8 max-w-sm rounded-2xl bg-surface p-5 text-center text-sm text-muted shadow-sm">
            <div className="mb-1 font-semibold text-heading">Hi! How can we help?</div>
            Ask anything about your project, send files or share feedback here. Our team will reply in this chat.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.authorRole === "client";
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m._id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-muted shadow-sm">{day}</span>
                  </div>
                )}
                <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]",
                      mine ? "rounded-tr-sm bg-brand-gradient text-white" : "rounded-tl-sm border border-line bg-surface text-fg"
                    )}
                  >
                    {!mine && <div className="mb-0.5 text-[11px] font-semibold text-brand dark:text-[#8f9bff]">{companyName}</div>}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    <AttachmentList items={m.attachments} light={mine} />
                    <div className={cn("mt-1 text-right text-[10px]", mine ? "text-white/70" : "text-muted")}>
                      {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="input min-h-[44px] flex-1 resize-none"
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 1024px)").matches) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message"
          />
          <button onClick={send} className="btn btn-primary h-11 w-11 shrink-0 rounded-full p-0" disabled={sending || (!body.trim() && !files.length)} aria-label="Send">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2">
          <AttachmentPicker value={files} onChange={setFiles} />
        </div>
      </div>
    </div>
  );
}
