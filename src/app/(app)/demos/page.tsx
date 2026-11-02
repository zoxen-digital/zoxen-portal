import { ADMIN, pageUser } from "@/lib/session";
import { DemoSites } from "@/components/DemoSites";

export const metadata = { title: "Demo Websites" };

export default async function DemosPage() {
  await pageUser(ADMIN);
  return <DemoSites />;
}
