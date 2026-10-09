import { escapeRegex } from "./utils";

export type AuditFilters = { who?: string; role?: string; type?: string; from?: string; to?: string; q?: string; page?: string };

/** Mongo filter for the audit log page and its CSV export. */
export function auditFilter(f: AuditFilters) {
  const filter: Record<string, unknown> = {};
  if (f.who) filter.actorName = f.who;
  if (f.role) filter.actorRole = f.role;
  if (f.type === "deletes") filter.method = "DELETE";
  else if (f.type === "creates") filter.method = "POST";
  else if (f.type === "edits") filter.method = { $in: ["PUT", "PATCH"] };
  else if (f.type === "logins") filter.category = "login";
  const at: Record<string, Date> = {};
  if (f.from && !isNaN(Date.parse(f.from))) at.$gte = new Date(f.from);
  if (f.to && !isNaN(Date.parse(f.to))) at.$lt = new Date(new Date(f.to).getTime() + 86_400_000);
  if (Object.keys(at).length) filter.at = at;
  if (f.q) {
    const rx = { $regex: escapeRegex(f.q.slice(0, 80)), $options: "i" };
    filter.$or = [{ action: rx }, { target: rx }, { details: rx }, { actorName: rx }];
  }
  return filter;
}
