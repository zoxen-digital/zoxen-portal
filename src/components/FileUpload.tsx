"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useDialogs } from "./Dialogs";
import type { AttachmentT } from "@/lib/types";

const MAX_MB = 25;

/** Uploads files straight to storage and returns their links. */
export function useUploader() {
  const { notify } = useDialogs();
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);

  async function upload(files: FileList | File[]): Promise<AttachmentT[]> {
    const { upload: put } = await import("@vercel/blob/client");
    const done: AttachmentT[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_MB * 1024 * 1024) {
        notify(`${file.name} is larger than ${MAX_MB} MB`, "error");
        continue;
      }
      setUploading({ name: file.name, pct: 0 });
      try {
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
        const blob = await put(`uploads/${safe}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: file.type || undefined,
          multipart: file.size > 5 * 1024 * 1024,
          onUploadProgress: (p) => setUploading({ name: file.name, pct: Math.round(p.percentage) }),
        });
        done.push({ name: file.name, url: blob.url, size: file.size, contentType: file.type || undefined });
      } catch (e) {
        notify(`${file.name}: ${(e as Error).message || "upload failed"}`, "error");
      }
    }
    setUploading(null);
    return done;
  }

  return { upload, uploading };
}

/** "Attach files" button plus the list of files picked so far. */
export function AttachmentPicker({
  value,
  onChange,
  label = "Attach files",
}: {
  value: AttachmentT[];
  onChange: (v: AttachmentT[]) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useUploader();

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((a, i) => (
            <li key={a.url} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted" />
              <span className="max-w-[180px] truncate">{a.name}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted hover:text-red-500" aria-label="Remove">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={async (e) => {
          const files = e.target.files;
          if (!files?.length) return;
          const added = await upload(files);
          onChange([...value, ...added]);
          e.target.value = "";
        }}
      />
      <button type="button" onClick={() => input.current?.click()} disabled={!!uploading} className="btn btn-ghost btn-sm">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        {uploading ? `Uploading ${uploading.name.slice(0, 24)} ${uploading.pct}%` : label}
      </button>
    </div>
  );
}

export function AttachmentList({ items, light }: { items: AttachmentT[]; light?: boolean }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((a) => {
        const isImage = a.contentType?.startsWith("image/");
        return (
          <li key={a.url}>
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${light ? "bg-white/15 text-white hover:bg-white/25" : "bg-surface-2 text-fg hover:bg-line"}`}
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span className="max-w-[200px] truncate">{a.name}</span>
              {a.size ? <span className="opacity-60">{a.size > 1048576 ? `${(a.size / 1048576).toFixed(1)} MB` : `${Math.ceil(a.size / 1024)} KB`}</span> : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
