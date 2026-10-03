import { HttpError } from "./api";

export const CLIENT_FIELDS = ["name", "company", "email", "phone", "website", "address", "source", "status", "notes"];

export const QUERY_FIELDS = [
  "client",
  "title",
  "service",
  "description",
  "status",
  "priority",
  "assignedTo",
  "amount",
  "dueDate",
  "notes",
];

export const USER_FIELDS = ["name", "email", "role", "client", "title", "phone"];

/** Project fields any staff member on the project may edit. */
export const PROJECT_FIELDS = [
  "title",
  "service",
  "description",
  "stage",
  "progress",
  "startDate",
  "dueDate",
  "previewUrl",
  "liveUrl",
  "domain",
  "clientUpdate",
  "internalNotes",
];

export function cleanProject(data: Record<string, unknown>) {
  if ("progress" in data) {
    const n = Number(data.progress);
    data.progress = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : undefined;
    if (data.progress === undefined) delete data.progress;
  }
  if ("revisionLimit" in data) data.revisionLimit = Math.max(0, Math.round(Number(data.revisionLimit) || 0));
  for (const k of ["startDate", "dueDate"]) {
    if (k in data) data[k] = data[k] ? new Date(String(data[k])) : null;
  }
  return data;
}

export function cleanQuery(data: Record<string, unknown>) {
  if ("amount" in data) data.amount = Number(data.amount) || 0;
  if ("dueDate" in data) data.dueDate = data.dueDate ? new Date(String(data.dueDate)) : null;
  return data;
}

export const MEETING_FIELDS = ["client", "project", "title", "date", "link", "notes", "minutes"];

/** Validates a custom follow-up message sent to a client. */
export function followUpBody(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!title) throw new HttpError("Add a subject");
  if (!message) throw new HttpError("Write a message");
  return { title, body: message, email: body.email !== false };
}
