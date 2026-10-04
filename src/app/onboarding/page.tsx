import type { Metadata } from "next";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { issueUploadTicket } from "@/lib/onboarding";
import { referrerForCode } from "@/lib/referrals";
import { approvedReviews } from "@/lib/reviews";
import { OnboardingForm } from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { absolute: `Project Onboarding | ${s.companyName}` }, robots: { index: false, follow: false } };
}

/** Public onboarding form (general link, or a client's referral link with ?ref=CODE). */
export default async function PublicOnboardingPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  await dbConnect();
  const [s, referrer, reviews] = await Promise.all([getSettings(), ref ? referrerForCode(ref) : null, approvedReviews(6)]);
  return (
    <OnboardingForm
      ticket={issueUploadTicket()}
      companyName={s.companyName}
      contactEmail={s.email}
      reviews={reviews}
      referral={referrer ? { code: String(ref).toUpperCase(), by: referrer.company || referrer.name } : undefined}
    />
  );
}
