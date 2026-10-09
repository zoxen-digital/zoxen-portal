import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";

/** The client may fill the onboarding form once an invoice is fully paid (older clients: any paid invoice counts). */
export async function onboardingOpen(clientId: string) {
  const c = await Client.findById(clientId).select("onboardingUnlockedAt").lean<{ onboardingUnlockedAt?: Date | null }>();
  if (c?.onboardingUnlockedAt) return true;
  return !!(await Invoice.exists({ client: clientId, status: "Paid" }));
}
