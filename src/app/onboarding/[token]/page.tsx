import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { clientForToken, issueUploadTicket } from "@/lib/onboarding";
import { OnboardingForm } from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { absolute: `Project Onboarding | ${s.companyName}` }, robots: { index: false, follow: false } };
}

/** A client's personal onboarding link: the form is pre-filled and the submission is tagged to them. */
export default async function ClientOnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await dbConnect();
  const client = await clientForToken(token);
  if (!client) notFound();
  const s = await getSettings();
  return (
    <OnboardingForm
      ticket={issueUploadTicket()}
      token={token}
      companyName={s.companyName}
      contactEmail={s.email}
      prefill={{
        contactPerson: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        businessName: client.company || "",
        currentWebsite: client.website || "",
      }}
    />
  );
}
