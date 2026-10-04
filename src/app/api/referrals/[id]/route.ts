import { dbConnect } from "@/lib/db";
import { Referral } from "@/models/Referral";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { clientUserIds, notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

/** { action: "reward", note } marks the reward as given and tells the client; { action: "undo" } reverts it. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Referral not found", 404);
  const { action, note } = await req.json().catch(() => ({}));
  await dbConnect();

  if (action === "reward") {
    const text = typeof note === "string" ? note.trim().slice(0, 300) : "";
    if (!text) return error("Write what you gave, e.g. 10% off invoice ZD-2026-014");
    const ref = await Referral.findOneAndUpdate(
      { _id: id, status: "Converted" },
      { $set: { status: "Rewarded", rewardNote: text, rewardedAt: new Date(), rewardedBy: user.name } },
      { new: true }
    );
    if (!ref) return error("Only a converted referral can be rewarded");
    await notify(await clientUserIds(String(ref.referrer)), {
      title: "Your referral reward is here",
      body: text,
      link: "/portal/referrals",
      email: { button: "See your referrals" },
    });
    return json(ref);
  }
  if (action === "undo") {
    const ref = await Referral.findOneAndUpdate(
      { _id: id, status: "Rewarded" },
      { $set: { status: "Converted" }, $unset: { rewardNote: 1, rewardedAt: 1, rewardedBy: 1 } },
      { new: true }
    );
    return ref ? json(ref) : error("Nothing to undo");
  }
  return error("Unknown action");
});
