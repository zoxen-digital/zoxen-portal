import Link from "next/link";
import { ClipboardList, ExternalLink } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { clientFormToken } from "@/lib/onboarding";
import { Onboarding } from "@/models/Onboarding";
import { Badge } from "@/components/ui";
import { OnboardingDetails } from "@/components/OnboardingDetails";
import { formatDate, serialize } from "@/lib/utils";
import type { OnboardingT } from "@/lib/types";

export const metadata = { title: "Onboarding" };

/** The client's own onboarding answers (and the link to fill the form if they have not yet). */
export default async function PortalOnboarding() {
  const user = await pageUser(["client"]);
  await dbConnect();
  const [docs, token] = await Promise.all([
    Onboarding.find({ client: user.clientId }).sort({ createdAt: -1 }).lean(),
    clientFormToken(user.clientId!),
  ]);
  const forms = serialize<OnboardingT[]>(docs);
  const formLink = `/onboarding/${token}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[28px]">Onboarding</h1>
          <p className="mt-1 text-sm text-muted">The business details, goals and preferences you shared with us.</p>
        </div>
        <Link href={formLink} target="_blank" className="btn btn-primary">
          <ExternalLink className="h-4 w-4" /> {forms.length ? "Submit another form" : "Fill the onboarding form"}
        </Link>
      </div>

      {forms.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <ClipboardList className="h-10 w-10 text-brand dark:text-[#8f9bff]" />
          <h2 className="text-lg font-bold text-heading">Tell us about your project</h2>
          <p className="max-w-md text-sm text-muted">It takes about 5 minutes: your business, goals, pages, design style and content. We start as soon as it is approved.</p>
          <Link href={formLink} target="_blank" className="btn btn-primary mt-2">Start the form</Link>
        </div>
      ) : (
        forms.map((f) => {
          const approved = f.status === "Approved" || f.status === "Converted";
          return (
            <div key={f._id} className="card p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <div className="font-bold text-heading">{f.company || f.name}</div>
                  <div className="text-xs text-muted">Submitted {formatDate(f.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={approved ? "Approved" : f.status === "Rejected" ? "Rejected" : "Pending"} dot />
                  {approved && f.project && (
                    <Link href={`/portal/projects/${f.project}`} className="btn btn-outline btn-sm">
                      View project
                    </Link>
                  )}
                </div>
              </div>
              {!approved && f.status !== "Rejected" && (
                <p className="mb-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-brand dark:bg-blue-500/10 dark:text-blue-200">
                  Thanks! Our team is reviewing your answers and will start your project once approved.
                </p>
              )}
              <OnboardingDetails item={f} />
            </div>
          );
        })
      )}
    </div>
  );
}
