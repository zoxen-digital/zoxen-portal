import { pageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { PortalChat } from "@/components/PortalChat";

export const metadata = { title: "Chat" };

export default async function PortalChatPage() {
  await pageUser(["client"]);
  const { companyName } = await getSettings();
  return <PortalChat companyName={companyName || "Our team"} />;
}
