import { HttpError } from "./api";
import { ISSUE_STATUSES, REVISION_STATUSES } from "./constants";
import { clientUserIds, notify } from "./notify";
import { logActivity } from "./projects";
import type { CurrentUser } from "./session";

/** The lists that live inside a project, editable through /api/projects/[id]/[kind]. */
export const ITEM_KINDS = ["checklist", "issues", "revisions", "documents"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const date = (v: unknown) => (v ? new Date(String(v)) : null);
const bool = (v: unknown) => v === true || v === "true";

/** Turns a request body into the fields allowed for this kind of item. */
export function itemData(kind: ItemKind, body: Record<string, unknown>, creating: boolean) {
  const has = (k: string) => creating || k in body;
  const d: Record<string, unknown> = {};
  if (kind === "checklist") {
    if (has("label")) d.label = str(body.label);
    if ("done" in body) d.done = bool(body.done);
    if (creating && !d.label) throw new HttpError("Checklist item is required");
  } else if (kind === "issues") {
    if (has("title")) d.title = str(body.title);
    if (has("details")) d.details = str(body.details);
    if (has("owner")) d.owner = str(body.owner);
    if (has("dueDate")) d.dueDate = date(body.dueDate);
    if (has("visibleToClient")) d.visibleToClient = bool(body.visibleToClient);
    if ("status" in body) {
      if (!ISSUE_STATUSES.includes(body.status as never)) throw new HttpError("Invalid status");
      d.status = body.status;
    }
    if (creating && !d.title) throw new HttpError("Describe the issue");
  } else if (kind === "revisions") {
    if (has("request")) d.request = str(body.request);
    if (has("links")) d.links = str(body.links);
    if ("status" in body) {
      if (!REVISION_STATUSES.includes(body.status as never)) throw new HttpError("Invalid status");
      d.status = body.status;
    }
    if (creating && !d.request) throw new HttpError("Describe the changes");
  } else {
    if (has("name")) d.name = str(body.name);
    if (has("url")) d.url = str(body.url);
    if (has("visibleToClient")) d.visibleToClient = creating && !("visibleToClient" in body) ? true : bool(body.visibleToClient);
    if (creating && (!d.name || !d.url)) throw new HttpError("Document name and link are required");
    if (d.url && !/^https?:\/\//i.test(String(d.url))) throw new HttpError("Link must start with http:// or https://");
  }
  if ("label" in d && !d.label) throw new HttpError("Checklist item is required");
  if ("title" in d && !d.title) throw new HttpError("Describe the issue");
  return d;
}

/** Adds a revision round, flagging it when it goes past the package limit. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addRevision(project: any, data: Record<string, unknown>, requestedBy: string) {
  const round = (project.revisions?.length || 0) + 1;
  const extra = project.revisionLimit > 0 && round > project.revisionLimit;
  project.revisions.push({ ...data, round, requestedBy, extra, status: "Requested" });
  return project.revisions[project.revisions.length - 1];
}

/** Side effects after an item changes: timestamps, activity log and client notifications. */
export async function afterItemChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any,
  kind: ItemKind,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any,
  before: Record<string, unknown> | null,
  user: CurrentUser
) {
  const link = `/portal/projects/${project._id}`;
  const clients = async () => clientUserIds(String(project.client));

  if (kind === "checklist" && before && before.done !== item.done) {
    item.doneAt = item.done ? new Date() : undefined;
    await project.save();
    if (item.done) await logActivity(project, user, `Completed: ${item.label}`, true);
  }

  if (kind === "issues") {
    if (before && before.status !== item.status) {
      item.resolvedAt = item.status === "Resolved" ? new Date() : undefined;
      await project.save();
      await logActivity(project, user, `Issue ${item.status === "Resolved" ? "resolved" : "reopened"}: ${item.title}`, item.visibleToClient);
    } else if (!before) {
      await logActivity(project, user, `Issue logged: ${item.title}`, false);
    }
    const nowVisible = item.visibleToClient && item.status !== "Resolved";
    const wasVisible = before ? before.visibleToClient && before.status !== "Resolved" : false;
    if (nowVisible && !wasVisible) {
      await notify(await clients(), {
        title: `Action needed: ${project.title}`,
        body: item.title,
        link,
        email: { subject: `Action needed on ${project.title}`, button: "View details" },
      });
    }
  }

  if (kind === "revisions") {
    if (!before) {
      await logActivity(project, user, `Revision round ${item.round} logged`, true);
    } else if (before.status !== item.status) {
      item.completedAt = item.status === "Done" ? new Date() : undefined;
      await project.save();
      await logActivity(project, user, `Revision round ${item.round}: ${item.status}`, true);
      if (item.status === "Done") {
        await notify(await clients(), { title: `Revision round ${item.round} done: ${project.title}`, body: "Your requested changes are complete.", link });
      }
    }
  }

  if (kind === "documents" && !before) {
    await logActivity(project, user, `Document added: ${item.name}`, item.visibleToClient);
    if (item.visibleToClient) await notify(await clients(), { title: `New document: ${item.name}`, body: project.title, link });
  }
}
