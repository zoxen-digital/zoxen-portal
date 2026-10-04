import { randomBytes } from "crypto";
import { clientUserIds, notify, superAdminIds } from "./notify";
import { getSettings } from "./settings";
import { Client } from "@/models/Client";
import { Referral } from "@/models/Referral";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CODE = /^[A-Z0-9]{6,12}$/;

/** The client's referral code (created the first time it is needed). */
export async function referralCodeFor(clientId: string) {
  const c = await Client.findById(clientId).select("referralCode");
  if (!c) return null;
  if (!c.referralCode) {
    // Readable code without look-alike characters (no 0/O, 1/I).
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 5 && !c.referralCode; i++) {
      const code = Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join("");
      if (!(await Client.exists({ referralCode: code }))) c.referralCode = code;
    }
    await c.save();
  }
  return c.referralCode as string;
}

export async function referrerForCode(code?: string | null) {
  const c = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!CODE.test(c)) return null;
  return Client.findOne({ referralCode: c }).select("name company email").lean<any>();
}

/**
 * A form arrived through a referral link: remember who referred it.
 * Ignored when the form is the referrer's own (personal link or same email).
 */
export async function recordReferral(sub: any, code: unknown) {
  const referrer = await referrerForCode(code as string);
  if (!referrer) return;
  if (sub.client && String(sub.client) === String(referrer._id)) return;
  if (referrer.email && sub.email && referrer.email.toLowerCase() === String(sub.email).toLowerCase()) return;

  sub.referredBy = referrer._id;
  await sub.save();
  await Referral.create({
    referrer: referrer._id,
    onboarding: sub._id,
    leadName: sub.name,
    leadCompany: sub.company,
    leadEmail: sub.email,
    status: "Submitted",
  });
  await notify(await clientUserIds(String(referrer._id)), {
    title: "Thanks for the referral!",
    body: `${sub.company || sub.name} filled in our onboarding form through your link. We will let you know when their project starts.`,
    link: "/portal/referrals",
  });
}

/** The referred form was approved: the referral counts, and the reward becomes due. */
export async function referralConverted(sub: any, clientId: string, projectId: string) {
  const ref = await Referral.findOneAndUpdate(
    { onboarding: sub._id, status: "Submitted" },
    { $set: { status: "Converted", newClient: clientId, project: projectId, convertedAt: new Date() } },
    { new: true }
  );
  if (!ref) return;
  const s = await getSettings();
  await notify(await clientUserIds(String(ref.referrer)), {
    title: "Your referral started a project!",
    body: `${ref.leadCompany || ref.leadName} is now a client. ${s.referralReward ? `Your reward: ${s.referralReward}` : "Thank you!"}`,
    link: "/portal/referrals",
    email: { button: "See your referrals" },
  });
  const referrer = await Client.findById(ref.referrer).select("name company").lean<any>();
  await notify(await superAdminIds(), {
    title: `Referral reward due: ${referrer?.company || referrer?.name || "client"}`,
    body: `${ref.leadCompany || ref.leadName} started a project through their link. Give the reward, then mark it rewarded.`,
    link: "/referrals",
  });
}

export async function referralNotConverted(subId: unknown) {
  await Referral.updateOne({ onboarding: subId, status: "Submitted" }, { $set: { status: "Not converted" } });
}

/** A rejected form was reopened: its referral can still convert. */
export async function referralReopened(subId: unknown) {
  await Referral.updateOne({ onboarding: subId, status: "Not converted" }, { $set: { status: "Submitted" } });
}
