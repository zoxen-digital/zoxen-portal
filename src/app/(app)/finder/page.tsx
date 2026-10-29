import { STAFF, pageUser } from "@/lib/session";
import { LeadFinder } from "@/components/LeadFinder";

export const metadata = { title: "Lead Finder" };

export default async function FinderPage() {
  await pageUser(STAFF);
  return <LeadFinder />;
}
