import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { issueUploadTicket } from "@/lib/onboarding";
import { OnboardingForm } from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { absolute: `Project Onboarding | ${s.companyName}` }, robots: { index: false, follow: false } };
}

/** Public onboarding form (general link). Submissions wait for approval in Onboarding Submissions. */
export default async function PublicOnboardingPage() {
  const s = await getSettings();
  return <OnboardingForm ticket={issueUploadTicket()} companyName={s.companyName} contactEmail={s.email} />;
}
