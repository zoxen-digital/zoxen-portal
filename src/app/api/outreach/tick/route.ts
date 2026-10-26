import { handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { tick } from "@/lib/outreach/engine";

export const maxDuration = 60;

/** One round of work, triggered by the open dashboard (the external cron does the same when it is closed). */
export const POST = handle(async () => {
  await apiUser(ADMIN);
  return json(await tick({ budgetMs: 40_000 }));
});
