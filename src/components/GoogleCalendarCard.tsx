"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, Loader2, Unplug } from "lucide-react";
import { api } from "@/lib/client-api";
import { useDialogs } from "./Dialogs";
import { LocalTime } from "./LocalTime";

type Status = { configured: boolean; connected: boolean; email: string; connectedAt: string | null; lastError: string };

const MESSAGES: Record<string, [string, "success" | "error"]> = {
  connected: ["Google Calendar connected. New meetings get a Google Meet link automatically.", "success"],
  denied: ["Google access was not allowed.", "error"],
  failed: ["Could not connect Google. Check that your Gmail is added as a test user and try again.", "error"],
  "not-configured": ["Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the environment first.", "error"],
};

export function GoogleCalendarCard({ status }: { status: Status }) {
  const router = useRouter();
  const params = useSearchParams();
  const { notify, confirm } = useDialogs();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const key = params.get("google");
    if (key && MESSAGES[key]) {
      notify(...MESSAGES[key]);
      router.replace("/settings");
    }
  }, [params, notify, router]);

  async function disconnect() {
    if (!(await confirm({ title: "Disconnect Google Calendar?", message: "New meetings will use your fixed meeting link instead.", confirmText: "Disconnect", tone: "danger" }))) return;
    setBusy(true);
    try {
      await api("/api/google/disconnect", "POST");
      notify("Google Calendar disconnected");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${status.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-surface-2 text-muted"}`}>
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-heading">Google Calendar &amp; Meet</h2>
            {status.connected ? (
              <p className="text-sm text-muted">
                Connected as <b className="text-fg">{status.email || "your Google account"}</b>
                {status.connectedAt && (
                  <>
                    {" "}since <LocalTime iso={status.connectedAt} dateOnly />
                  </>
                )}
                . Every new meeting gets its own Meet link, goes on your calendar and the client gets the invite.
              </p>
            ) : (
              <p className="text-sm text-muted">
                {status.lastError ? <span className="font-semibold text-red-500">{status.lastError}. </span> : null}
                Connect to create a Google Meet link and calendar invite for every meeting automatically.
                {!status.configured && " (Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the environment first.)"}
              </p>
            )}
          </div>
        </div>
        {status.connected ? (
          <div className="flex gap-2">
            <a href="/api/google/connect" className="btn btn-outline">Reconnect</a>
            <button onClick={disconnect} disabled={busy} className="btn btn-danger">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />} Disconnect
            </button>
          </div>
        ) : (
          <a href={status.configured ? "/api/google/connect" : undefined} aria-disabled={!status.configured} className={`btn btn-primary ${status.configured ? "" : "pointer-events-none opacity-50"}`}>
            Connect Google Calendar
          </a>
        )}
      </div>
    </div>
  );
}
