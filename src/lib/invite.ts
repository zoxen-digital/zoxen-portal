import { newToken } from "./password";
import { appUrl, mailEnabled, sendMail } from "./mailer";
import { getSettings } from "./settings";
import { User } from "@/models/User";

const INVITE_DAYS = 7;

/**
 * Creates a fresh one-time "set your password" link for a user and emails it.
 * Works for first-time invites and for password resets (an active user keeps
 * their old password until they use the link).
 */
export async function issueInvite(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  const { token, hash } = newToken();
  user.inviteTokenHash = hash;
  user.inviteExpires = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  await user.save();

  const link = appUrl(`/invite/${token}`);
  const s = await getSettings();
  const company = s.companyName || "Zoxen Digital";
  const isReset = user.status === "active";
  const isClient = user.role === "client";

  const emailed = mailEnabled()
    ? await sendMail({
        to: user.email,
        subject: isReset ? `Reset your ${company} password` : `Your ${company} ${isClient ? "client portal" : "team"} access`,
        heading: isReset ? "Set a new password" : isClient ? "Welcome to your client portal" : `You have been added to the ${company} team`,
        lines: [
          `Hi ${user.name.split(" ")[0]},`,
          isReset
            ? "Use the button below to choose a new password for your account."
            : isClient
              ? "Your portal is ready. Track your project status, review and approve work, request changes and see your invoices, all in one place."
              : "Your team account is ready. You will see the projects and queries assigned to you.",
          `This link works once and expires in ${INVITE_DAYS} days. Your login email is ${user.email}.`,
        ],
        button: { label: isReset ? "Set new password" : "Set your password", url: link },
      })
    : false;

  return { link, emailed };
}
