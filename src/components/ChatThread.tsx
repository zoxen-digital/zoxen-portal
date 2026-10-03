"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessagesSquare, Send } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { AttachmentList, AttachmentPicker } from "./FileUpload";
import { LIVE_EVENT } from "./LiveUpdates";
import { useDialogs } from "./Dialogs";
import type { AttachmentT, MessageT } from "@/lib/types";

function when(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Conversation between the client and the team.
 * `side` decides which messages are "mine" (right-hand bubbles): the client, or anyone on the team.
 */
export function ChatThread({
  endpoint,
  side,
  title = "Messages",
  subtitle,
  uploads = true,
}: {
  endpoint: string;
  side: "client" | "team";
  title?: string;
  subtitle?: string;
  uploads?: boolean;
}) {
  const { notify } = useDialogs();
  const [messages, setMessages] = useState<MessageT[] | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<AttachmentT[]>([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    try {
      setMessages(await api<MessageT[]>(endpoint));
    } catch {
      setMessages((m) => m ?? []);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
    window.addEventListener(LIVE_EVENT, load);
    return () => window.removeEventListener(LIVE_EVENT, load);
  }, [load]);

  // Keep the newest message in view when new ones arrive.
  useEffect(() => {
    if (!messages || messages.length === count.current) return;
    count.current = messages.length;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (sending || (!body.trim() && !files.length)) return;
    setSending(true);
    try {
      const m = await api<MessageT>(endpoint, "POST", { body, attachments: files });
      setMessages((xs) => [...(xs || []), m]);
      setBody("");
      setFiles([]);
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  const mine = (m: MessageT) => (side === "client" ? m.authorRole === "client" : m.authorRole !== "client");

  return (
    <div id="chat" className="card scroll-mt-24 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-5">
        <MessagesSquare className="h-5 w-5 text-brand dark:text-[#8f9bff]" />
        <div>
          <h2 className="font-bold text-heading">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      <div ref={listRef} className="max-h-[460px] min-h-[160px] space-y-3 overflow-y-auto bg-surface-2/40 p-4">
        {messages === null ? (
          <div className="flex justify-center py-8 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No messages yet. Start the conversation here instead of WhatsApp, so everything stays on record.</p>
        ) : (
          messages.map((m) => {
            const me = mine(m);
            return (
              <div key={m._id} className={cn("flex gap-2", me && "flex-row-reverse")}>
                <Avatar name={m.authorName} className="mt-5 h-7 w-7 text-[10px]" />
                <div className={cn("max-w-[78%]", me && "text-right")}>
                  <div className="mb-1 text-[11px] text-muted">
                    {m.authorName}
                    {m.authorRole !== "client" && side === "client" ? " · Team" : ""} · {when(m.createdAt)}
                  </div>
                  <div
                    className={cn(
                      "inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm",
                      me ? "rounded-tr-sm bg-brand-gradient text-white" : "rounded-tl-sm border border-line bg-surface text-fg"
                    )}
                  >
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    <AttachmentList items={m.attachments} light={me} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className="space-y-2 border-t border-line p-3">
        <textarea
          className="input min-h-[44px]"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message... (Enter to send, Shift+Enter for a new line)"
        />
        <div className="flex items-start justify-between gap-2">
          {uploads ? <AttachmentPicker value={files} onChange={setFiles} /> : <span />}
          <button className="btn btn-primary btn-sm" disabled={sending || (!body.trim() && !files.length)}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
          </button>
        </div>
      </form>
    </div>
  );
}
