import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";
import { User } from "@/models/User";
import { Client } from "@/models/Client";
import { error, handle, json } from "@/lib/api";
import { cleanAnswers, clientForToken, submissionFields } from "@/lib/onboarding";
import { notify } from "@/lib/notify";
import { recordReferral } from "@/lib/referrals";

/**
 * The public onboarding form posts here (no login).
 * With a client link token the submission is tagged to that client, but it still waits for approval.
 */
export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Invalid form");
  // Hidden field only bots fill in: accept silently, save nothing.
  if (typeof body.company_site === "string" && body.company_site.trim()) return json({ ok: true });

  const answers = cleanAnswers(body);
  await dbConnect();
  const client = await clientForToken(body.token);
  const sub = await Onboarding.create({ ...submissionFields(answers), client: client?._id, status: "New" });
  // The form is in; the half-filled draft is no longer needed.
  if (client) await Client.updateOne({ _id: client._id }, { $unset: { onboardingDraft: 1 } });
  // Came through a client referral link?
  if (body.ref) await recordReferral(sub, body.ref);

  const staff = await User.find({ role: { $in: ["super_admin", "team_admin"] }, status: "active" }).select("_id").lean();
  await notify(
    staff.map((u) => String(u._id)),
    {
      title: `New onboarding form: ${answers.businessName}`,
      body: `${answers.contactPerson} · ${answers.package} package${client ? ` · linked to ${client.company || client.name}` : ""}. Review and approve it.`,
      link: `/submissions?open=${sub._id}`,
      email: { button: "Review form" },
    }
  );
  return json({ ok: true }, 201);
});
