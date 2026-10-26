import { Suspense } from "react";
import { ADMIN, pageUser } from "@/lib/session";
import { OutreachDashboard } from "@/components/Outreach";

export const metadata = { title: "Cold Email" };

export default async function OutreachPage() {
  await pageUser(ADMIN);
  return (
    <Suspense>
      <OutreachDashboard />
    </Suspense>
  );
}
