import { Suspense } from "react";
import { STAFF, pageUser } from "@/lib/session";
import { Inbox } from "@/components/Inbox";

export const metadata = { title: "Inbox" };

/** WhatsApp-style client chats for the team. */
export default async function InboxPage() {
  const user = await pageUser(STAFF);
  return (
    <Suspense>
      <Inbox meId={user.id} canStart={user.role === "super_admin"} />
    </Suspense>
  );
}
