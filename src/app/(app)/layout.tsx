import { AppShell } from "@/components/AppShell";
import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let newSubmissions = 0;
  try {
    await dbConnect();
    newSubmissions = await Onboarding.countDocuments({ status: "New" });
  } catch {
    // The page itself will show the database error.
  }

  return (
    <AppShell
      userName={process.env.ADMIN_NAME || "Admin"}
      userEmail={process.env.ADMIN_EMAIL || ""}
      newSubmissions={newSubmissions}
    >
      {children}
    </AppShell>
  );
}
