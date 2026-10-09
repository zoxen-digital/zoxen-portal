import { dbConnect } from "./db";
import { AuditLog } from "@/models/AuditLog";
import { TrashItem } from "@/models/TrashItem";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Requests that are not worth recording (they happen constantly and change nothing important). */
const SKIP = [/^\/api\/notifications/, /^\/api\/push/, /^\/api\/live/, /^\/api\/upload/, /^\/api\/public\/onboarding\/draft/, /^\/api\/auth\//];

const NOUN: Record<string, string> = {
  invoices: "invoice",
  clients: "client",
  projects: "project",
  users: "user",
  quotes: "quote",
  contracts: "contract",
  tickets: "ticket",
  meetings: "meeting",
  recurring: "recurring plan",
  packages: "package",
  reviews: "review",
  referrals: "referral",
  onboarding: "onboarding form",
  settings: "settings",
  queries: "query",
  account: "own account",
  google: "Google connection",
};

/** Specific actions first; anything else falls back to "Created / Updated / Deleted <thing>". */
const RULES: [RegExp, string][] = [
  [/^POST \/api\/invoices\/[^/]+\/payments$/, "Recorded a payment"],
  [/^DELETE \/api\/invoices\/[^/]+\/payments$/, "Removed a payment"],
  [/^POST \/api\/invoices\/[^/]+\/remind$/, "Sent a payment reminder"],
  [/^POST \/api\/onboarding\/[^/]+\/approve$/, "Approved an onboarding form"],
  [/^POST \/api\/users\/[^/]+\/invite$/, "Sent an invite / password reset"],
  [/^POST \/api\/(projects|tickets)\/[^/]+\/messages$/, "Sent a message to the client"],
  [/^POST \/api\/(clients|projects)\/[^/]+\/notify$/, "Sent a follow-up to the client"],
  [/^POST \/api\/clients\/[^/]+\/report$/, "Sent a monthly report"],
  [/^POST \/api\/clients\/[^/]+\/onboarding-link$/, "Shared the onboarding form link"],
  [/^POST \/api\/packages\/[^/]+\/start$/, "Started a package for a client"],
  [/^POST \/api\/recurring\/[^/]+\/run$/, "Billed a recurring plan now"],
  [/^(POST|PUT|DELETE) \/api\/projects\/[^/]+\/(checklist|issues|revisions|documents)/, "Changed project $2"],
  [/^POST \/api\/portal\/projects\/[^/]+\/approve$/, "Client approved the work"],
  [/^POST \/api\/portal\/projects\/[^/]+\/revision$/, "Client requested changes"],
  [/^POST \/api\/portal\/projects\/[^/]+\/feedback$/, "Client left feedback"],
  [/^POST \/api\/portal\/projects\/[^/]+\/messages$/, "Client sent a message"],
  [/^POST \/api\/portal\/tickets$/, "Client opened a support ticket"],
  [/^POST \/api\/portal\/tickets\/[^/]+\/messages$/, "Client replied on a ticket"],
  [/^PUT \/api\/portal\/tickets\/[^/]+$/, "Client closed / reopened a ticket"],
  [/^POST \/api\/portal\/meetings$/, "Client requested a meeting"],
  [/^POST \/api\/portal\/reviews$/, "Client wrote a review"],
  [/^POST \/api\/public\/quotes\/[^/]+\/accept$/, "Client accepted a quote"],
  [/^POST \/api\/public\/quotes\/[^/]+\/decline$/, "Client declined a quote"],
  [/^POST \/api\/public\/contracts\/[^/]+\/sign$/, "Client signed a contract"],
  [/^POST \/api\/public\/onboarding$/, "Onboarding form submitted"],
  [/^POST \/api\/agent\/users$/, "Owner created a user"],
  [/^PUT \/api\/agent\/users\/[^/]+$/, "Owner updated a user"],
  [/^DELETE \/api\/agent\/users\/[^/]+$/, "Owner deleted a user"],
  [/^POST \/api\/agent\/users\/[^/]+\/logout$/, "Owner forced a logout"],
  [/^POST \/api\/agent\/trash\/[^/]+$/, "Owner restored from the recycle bin"],
];

export function shouldAudit(method: string, path: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method) && path.startsWith("/api/") && !SKIP.some((r) => r.test(path));
}

export function describe(method: string, path: string, body: any) {
  const key = `${method} ${path}`;
  for (const [re, text] of RULES) {
    const m = key.match(re);
    if (m) return text.replace("$2", m[2] || "");
  }
  const seg = path.split("/")[2] || "";
  const noun = NOUN[seg] || seg;
  if (body && typeof body === "object") {
    if (typeof body.action === "string") return `${cap(body.action)} ${noun}`;
    if (typeof body.status === "string" && Object.keys(body).length <= 2) return `Changed ${noun} status to ${body.status}`;
    if (typeof body.stage === "string" && Object.keys(body).length <= 2) return `Moved ${noun} to ${body.stage}`;
  }
  const verb = method === "POST" ? "Created" : method === "DELETE" ? "Deleted" : "Updated";
  return `${verb} ${noun}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Which fields changed, without secrets. */
export function summarizeBody(body: any) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const hidden = /pass|token|secret|ticket|signature|^data$/i;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (hidden.test(k)) {
      if (/pass/i.test(k) && v) parts.push(`${k}: (changed)`);
      continue;
    }
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") parts.push(`${k}: ${String(v).slice(0, 60)}`);
    else if (Array.isArray(v)) parts.push(`${k}: ${v.length} item${v.length === 1 ? "" : "s"}`);
  }
  return parts.join(" · ").slice(0, 400);
}

/** A readable name for the thing that was changed. */
export function targetOf(data: any) {
  const d = data && typeof data === "object" ? (data.quote || data.contract || data.meeting || data.user || data) : null;
  if (!d || typeof d !== "object") return "";
  const v = d.invoiceNumber || d.number || d.title || d.company || d.name || d.email;
  return typeof v === "string" ? v.slice(0, 160) : "";
}

export async function writeAudit(entry: {
  actor?: { id: string; name: string; role: string };
  method: string;
  path: string;
  status: number;
  body: any;
  response: any;
  ip?: string;
  batch?: string;
}) {
  try {
    await dbConnect();
    let target = targetOf(entry.response);
    if (!target && entry.method === "DELETE" && entry.batch) {
      const t = await TrashItem.findOne({ batch: entry.batch }).sort({ deletedAt: 1 }).select("label model").lean<{ label: string; model: string }>();
      if (t) target = `${t.label}`;
    }
    await AuditLog.create({
      actorId: entry.actor?.id,
      actorName: entry.actor?.name || "Visitor (public link)",
      actorRole: entry.actor?.role || "public",
      action: describe(entry.method, entry.path, entry.body),
      category: entry.path.split("/")[2] || "other",
      method: entry.method,
      path: entry.path,
      target,
      details: summarizeBody(entry.body),
      ip: entry.ip,
      status: entry.status,
      batch: entry.batch,
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}

export async function writeAuditEvent(e: { actor?: { id: string; name: string; role: string }; action: string; category: string; target?: string; details?: string; ip?: string }) {
  try {
    await dbConnect();
    await AuditLog.create({
      actorId: e.actor?.id,
      actorName: e.actor?.name || "Visitor",
      actorRole: e.actor?.role || "public",
      action: e.action,
      category: e.category,
      target: e.target,
      details: e.details,
      ip: e.ip,
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
