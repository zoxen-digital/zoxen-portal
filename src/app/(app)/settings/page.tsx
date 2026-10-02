import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Company details, invoice defaults, payment info and team." />
      <SettingsForm initial={settings} />
    </div>
  );
}
