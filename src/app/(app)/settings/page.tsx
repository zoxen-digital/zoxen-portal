import { Suspense } from "react";
import { getSettings } from "@/lib/settings";
import { googleStatus } from "@/lib/google";
import { ADMIN, pageUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";
import { GoogleCalendarCard } from "@/components/GoogleCalendarCard";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await pageUser(ADMIN);
  const [settings, google] = await Promise.all([getSettings(), googleStatus()]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Company details, invoice defaults, payment info, meetings and team." />
      <Suspense>
        <GoogleCalendarCard status={google} />
      </Suspense>
      <SettingsForm initial={settings} />
    </div>
  );
}
