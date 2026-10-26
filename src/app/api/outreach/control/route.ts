import { error, handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { getConfig, log, tick } from "@/lib/outreach/engine";
import { OutreachConfig, OutreachMailbox } from "@/models/Outreach";

export const maxDuration = 60;

/** Run / pause / resume / stop the campaign. "Run" and "resume" also do one round of work straight away. */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(ADMIN);
  const { action } = await req.json().catch(() => ({}));
  const cfg = await getConfig();
  if (action === "run" || action === "resume") {
    if (!(cfg.targets || []).length) return error("Add at least one target (category + city) in Settings first");
    if (!cfg.postalAddress?.trim()) return error("Add your business postal address in Settings first (US law requires it in every email)");
    if (!(await OutreachMailbox.exists({ active: true }))) return error("Connect a sending mailbox in Settings first");
    await OutreachConfig.updateOne({ key: "main" }, { $set: { status: "running", pausedReason: "" } });
    await log(`Campaign ${action === "run" ? "started" : "resumed"} by ${user.name}`);
    const result = await tick({ budgetMs: 45_000 });
    return json({ status: "running", result });
  }
  if (action === "pause" || action === "stop") {
    await OutreachConfig.updateOne({ key: "main" }, { $set: { status: action === "pause" ? "paused" : "stopped", pausedReason: "" } });
    await log(`Campaign ${action === "pause" ? "paused" : "stopped"} by ${user.name}`);
    return json({ status: action === "pause" ? "paused" : "stopped" });
  }
  if (action === "restart-targets") {
    await OutreachConfig.updateOne({ key: "main" }, { $set: { "targets.$[].done": false } });
    return json({ ok: true });
  }
  return error("Unknown action");
});
