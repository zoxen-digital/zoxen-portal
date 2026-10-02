"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "primary" | "danger" | "success";
};
type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

type Ctx = {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  notify: (message: string, tone?: ToastTone) => void;
};

const DialogContext = createContext<Ctx | null>(null);

export function useDialogs() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialogs must be used inside <DialogProvider>");
  return ctx;
}

/** In-app confirm popups and toast messages (replaces the browser's confirm/alert). */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })),
    []
  );

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  function close(result: boolean) {
    dialog?.resolve(result);
    setDialog(null);
  }

  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}
      {dialog && <ConfirmDialog options={dialog} onClose={close} />}
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card pointer-events-auto flex items-start gap-3 p-3.5 shadow-xl"
            style={{ animation: "zx-pop 0.18s ease-out" }}
          >
            {t.tone === "success" && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />}
            {t.tone === "error" && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />}
            {t.tone === "info" && <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" />}
            <p className="flex-1 text-sm font-medium text-fg">{t.message}</p>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-fg" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (v: boolean) => void }) {
  const tone = options.tone || "primary";
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Icon = tone === "danger" ? AlertTriangle : tone === "success" ? CheckCircle2 : HelpCircle;

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={() => onClose(false)} />
      <div className="card relative w-full max-w-md p-6 shadow-2xl" role="alertdialog" aria-modal="true" style={{ animation: "zx-pop 0.18s ease-out" }}>
        <div className="flex gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              tone === "danger" && "bg-red-500/10 text-red-500",
              tone === "success" && "bg-emerald-500/10 text-emerald-500",
              tone === "primary" && "bg-brand/10 text-brand dark:text-[#8f9bff]"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-heading">{options.title}</h2>
            {options.message && <div className="mt-1 text-sm text-muted">{options.message}</div>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => onClose(false)} className="btn btn-outline">
            {options.cancelText || "Cancel"}
          </button>
          <button
            ref={confirmRef}
            onClick={() => onClose(true)}
            className={cn(
              "btn",
              tone === "danger" ? "bg-red-500 text-white hover:bg-red-600" : tone === "success" ? "bg-emerald-500 text-white hover:bg-emerald-600" : "btn-primary"
            )}
          >
            {options.confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
