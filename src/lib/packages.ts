import { HttpError } from "./api";
import { normalizeLines } from "./docs";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Cleans a package form payload. */
export function packageData(body: any) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) throw new HttpError("Package name is required");
  const lines = normalizeLines(body);
  if (!lines.items.length) throw new HttpError("Add at least one priced item");
  const checklist = (Array.isArray(body.checklist) ? body.checklist : String(body.checklist || "").split("\n"))
    .map((s: unknown) => String(s).trim())
    .filter(Boolean)
    .slice(0, 50);
  return {
    name,
    service: typeof body.service === "string" ? body.service.trim() : "",
    description: typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "",
    items: lines.items,
    currency: lines.currency,
    checklist,
    revisionLimit: Math.max(0, Math.round(Number(body.revisionLimit) || 0)),
    durationDays: Math.max(1, Math.round(Number(body.durationDays) || 14)),
    active: body.active !== false,
  };
}
