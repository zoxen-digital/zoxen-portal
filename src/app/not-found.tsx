import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <Logo className="mb-6 justify-center" />
        <h1 className="text-xl font-bold text-heading">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you are looking for does not exist or was moved.</p>
        <Link href="/dashboard" className="btn btn-primary mt-6">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
