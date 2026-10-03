import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { User } from "@/models/User";
import { PageHeader } from "@/components/ui";
import { AccountForm } from "@/components/AccountForm";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await pageUser(["client"]);
  await dbConnect();
  const u = await User.findById(me.id).select("phone").lean<{ phone?: string }>();
  return (
    <div>
      <PageHeader title="My account" subtitle="Your profile, password and notification settings." />
      <AccountForm name={me.name} email={me.email} phone={u?.phone} />
    </div>
  );
}
