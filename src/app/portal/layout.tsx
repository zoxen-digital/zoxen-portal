import { InstallApp } from "@/components/InstallApp";
import { PortalShell } from "@/components/PortalShell";
import { pageUser } from "@/lib/session";
import { Client } from "@/models/Client";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Client Portal", template: "%s | Client Portal" } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser(["client"]);
  const client = user.clientId ? await Client.findById(user.clientId).select("name company").lean<{ name: string; company?: string }>() : null;
  return (
    <PortalShell userName={user.name} company={client?.company || client?.name || ""}>
      {children}
      <InstallApp />
    </PortalShell>
  );
}
