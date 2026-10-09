import { InstallApp } from "@/components/InstallApp";
import { PortalShell } from "@/components/PortalShell";
import { pageUser } from "@/lib/session";
import { Client } from "@/models/Client";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Client Portal", template: "%s | Client Portal" } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser(["client"]);
  const client = user.clientId ? await Client.findById(user.clientId).select("name company").lean<{ name: string; company?: string }>() : null;
  // Team messages the client has not opened yet (badge on Chat).
  let unread = 0;
  if (user.clientId) {
    const conv = await Conversation.findOne({ client: user.clientId }).select("clientReadAt lastTeamAt").lean<{ clientReadAt?: Date; lastTeamAt?: Date }>();
    if (conv?.lastTeamAt && (!conv.clientReadAt || conv.lastTeamAt > conv.clientReadAt)) {
      unread = await Message.countDocuments({
        client: user.clientId,
        ticket: null,
        internal: { $ne: true },
        authorRole: { $ne: "client" },
        ...(conv.clientReadAt ? { createdAt: { $gt: conv.clientReadAt } } : {}),
      });
    }
  }
  return (
    <PortalShell userName={user.name} company={client?.company || client?.name || ""} unread={unread}>
      {children}
      <InstallApp />
    </PortalShell>
  );
}
