import { error, handle, json } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { logActivity, projectFor, setStage, staffFor } from "@/lib/projects";
import { addRevision } from "@/lib/project-items";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string; action: string }> };

/**
 * Client actions from the portal:
 *  approve   — accepts the work under review, moves it to Launch
 *  revision  — requests changes, moves it to Revision
 *  feedback  — 1–5 rating plus comment
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(["client"]);
  const { id, action } = await params;
  const project = await projectFor(user, id);
  const body = await req.json().catch(() => ({}));
  const staffLink = `/projects/${project._id}`;

  if (action === "approve") {
    if (project.stage !== "Client Review") return error("This project is not waiting for your approval right now");
    project.approvedAt = new Date();
    project.approvedBy = user.name;
    await project.save();
    await logActivity(project, user, `${user.name} approved the work`, true);
    await setStage(project, "Launch", user, { silent: true });
    await notify(await staffFor(project), {
      title: `Approved by client: ${project.title}`,
      body: `${user.name} approved the work. Next step: launch / final delivery.`,
      link: staffLink,
      email: { button: "Open project" },
    });
    return json({ ok: true });
  }

  if (action === "revision") {
    const request = typeof body.request === "string" ? body.request.trim() : "";
    if (request.length < 5) return error("Please describe the changes you need");
    if (!["Client Review", "Live", "Launch"].includes(project.stage)) {
      return error("You can request changes when the project is ready for your review");
    }
    const links = typeof body.links === "string" ? body.links.trim() : "";
    const rev = addRevision(project, { request, links }, user.name);
    await project.save();
    await logActivity(project, user, `${user.name} requested changes (round ${rev.round})`, true);
    await setStage(project, "Revision", user, { silent: true });
    await notify(await staffFor(project), {
      title: `Changes requested: ${project.title}`,
      body: `Round ${rev.round}${rev.extra ? " (beyond the included revisions)" : ""}: ${request.slice(0, 140)}`,
      link: staffLink,
      email: { button: "Open project" },
    });
    return json({ ok: true, extra: rev.extra, round: rev.round });
  }

  if (action === "feedback") {
    const rating = Math.round(Number(body.rating));
    if (!(rating >= 1 && rating <= 5)) return error("Choose a rating from 1 to 5");
    const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : "";
    project.feedback = { rating, comment, at: new Date() };
    await project.save();
    await logActivity(project, user, `${user.name} left ${rating}/5 feedback`, false);
    await notify(await staffFor(project), {
      title: `Feedback ${rating}/5: ${project.title}`,
      body: comment || `${user.name} rated the project.`,
      link: staffLink,
    });
    return json({ ok: true });
  }

  return error("Not found", 404);
});
