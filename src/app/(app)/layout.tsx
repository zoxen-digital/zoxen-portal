import { InstallApp } from "@/components/InstallApp";
import { AppShell } from "@/components/AppShell";
import { dbConnect } from "@/lib/db";
import { STAFF, pageUser } from "@/lib/session";
import { Onboarding } from "@/models/Onboarding";
import { unreadChats } from "@/lib/inbox-count";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser([...STAFF, "agent"]);
  let newSubmissions = 0;
  let chats = 0;
  {
    try {
      await dbConnect();
      [newSubmissions, chats] = await Promise.all([Onboarding.countDocuments({ status: "New" }), unreadChats(user)]);
    } catch {
      // The page itself will show the database error.
    }
  }

  return (
    <AppShell userName={user.name} userEmail={user.email} role={user.role} newSubmissions={newSubmissions} unreadChats={chats}>
      {children}
      <InstallApp />
    </AppShell>
  );
}
