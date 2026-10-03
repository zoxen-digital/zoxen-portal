import { Logo } from "@/components/Logo";
import { dbConnect } from "@/lib/db";
import { hashToken } from "@/lib/password";
import { User } from "@/models/User";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await dbConnect();
  const user = await User.findOne({ inviteTokenHash: hashToken(token) })
    .select("name email status +inviteExpires")
    .lean<{ name: string; email: string; status: string; inviteExpires?: Date }>();
  const valid = !!user && user.status !== "disabled" && !!user.inviteExpires && new Date(user.inviteExpires).getTime() > Date.now();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet/10 blur-3xl" />
      <div className="card relative w-full max-w-md p-8 shadow-xl shadow-brand/5">
        <Logo className="mb-8" />
        {valid ? (
          <>
            <h1 className="text-2xl font-bold text-heading">
              {user.status === "active" ? "Set a new password" : `Welcome, ${user.name.split(" ")[0]}`}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Choose a password for <span className="font-semibold text-fg">{user.email}</span>.
            </p>
            <SetPasswordForm token={token} />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-heading">Link expired</h1>
            <p className="mt-2 text-sm text-muted">
              This link has expired or was already used. Please ask our team to send you a new one.
            </p>
            <a href="/login" className="btn btn-primary mt-6 w-full">Go to sign in</a>
          </>
        )}
      </div>
    </main>
  );
}
