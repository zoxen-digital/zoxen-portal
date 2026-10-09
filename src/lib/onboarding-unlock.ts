import { clientFormToken } from "./onboarding";
import { sendChatMessage } from "./inbox";
import { clientUserIds, notify } from "./notify";
import { appUrl } from "./mailer";
import type { CurrentUser } from "./session";
import { Client } from "@/models/Client";
import { Onboarding } from "@/models/Onboarding";

/**
 * Called after an invoice is saved. The first time one of the client's invoices is fully paid,
 * the onboarding form opens for them: a chat message with the link, a notification, and the
 * "Fill the form" option on their portal Onboarding page. Runs once per client.
 */
export async function unlockOnboardingIfPaid(invoice: { client: unknown; status: string }, user: CurrentUser) {
  if (invoice.status !== "Paid") return false;
  const clientId = String(invoice.client);
  // Claim first so two payments at the same moment cannot send it twice.
  const claimed = await Client.findOneAndUpdate({ _id: clientId, onboardingUnlockedAt: null }, { $set: { onboardingUnlockedAt: new Date() } });
  if (!claimed) return false;
  if (await Onboarding.exists({ client: clientId })) return false;
  try {
    const link = appUrl(`/onboarding/${await clientFormToken(clientId)}`);
    await sendChatMessage(user, clientId, {
      body: `Thank you for your payment! The next step is a short onboarding form (about 5 minutes) about your business, goals and design preferences, so we can start your project.\n\nFill it here: ${link}\n\nYou can also open it any time from Onboarding in your portal.`,
    });
    await notify(await clientUserIds(clientId), {
      title: "Payment received: please fill your onboarding form",
      body: "It takes about 5 minutes and lets us start your project.",
      link: "/portal/onboarding",
      email: { button: "Fill the form" },
    });
  } catch (e) {
    console.error("Onboarding unlock message failed:", e);
  }
  return true;
}
