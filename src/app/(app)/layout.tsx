import { AppShell } from "@/components/AppShell";
import { dbConnect } from "@/lib/db";
import { STAFF, pageUser } from "@/lib/session";
import { Onboarding } from "@/models/Onboarding";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser(STAFF);
  let newSubmissions = 0;
  if (user.role === "super_admin") {
    try {
      await dbConnect();
      newSubmissions = await Onboarding.countDocuments({ status: "New" });
    } catch {
      // The page itself will show the database error.
    }
  }

  return (
    <AppShell userName={user.name} userEmail={user.email} role={user.role} newSubmissions={newSubmissions}>
      {children}
    </AppShell>
  );
}
