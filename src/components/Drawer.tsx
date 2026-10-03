"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Full-height panel that slides in from the right. The page behind does not scroll;
 * only the body scrolls, while the header and footer stay in place.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Rendered at the end of <body> so table rows or cards can never clip or shift it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={onClose} />
      <aside
        className="relative flex h-full w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        style={{ animation: "zx-slide-in 0.2s ease-out" }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-heading">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
            {badge && <div className="mt-2 flex flex-wrap items-center gap-2">{badge}</div>}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm -mr-2 px-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        {footer && <footer className="shrink-0 border-t border-line bg-surface px-6 py-4 shadow-[0_-8px_24px_-16px_rgba(38,57,232,0.4)]">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}
