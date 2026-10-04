import { MessageSquareQuote, Quote } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { approvedReviews } from "@/lib/reviews";
import { Review } from "@/models/Review";
import { Client } from "@/models/Client";
import { Badge, EmptyState } from "@/components/ui";
import { Stars, WriteReviewButton } from "@/components/Reviews";
import { formatDate, serialize } from "@/lib/utils";
import type { ReviewT } from "@/lib/types";

export const metadata = { title: "Reviews" };

/** What our clients say (approved reviews from everyone) + the client's own reviews and their status. */
export default async function PortalReviews() {
  const user = await pageUser(["client"]);
  await dbConnect();
  const [reviews, mineDocs, client] = await Promise.all([
    approvedReviews(60),
    Review.find({ client: user.clientId }).sort({ createdAt: -1 }).lean(),
    Client.findById(user.clientId).select("company").lean<{ company?: string }>(),
  ]);
  const mine = serialize<ReviewT[]>(mineDocs);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-[28px]">What our clients say</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {reviews.length ? (
              <>
                <Stars value={Math.round(avg)} /> {avg.toFixed(1)} average from {reviews.length} review{reviews.length === 1 ? "" : "s"}
              </>
            ) : (
              "Be the first to share your experience."
            )}
          </p>
        </div>
        <WriteReviewButton defaultName={user.name} defaultCompany={client?.company || ""} />
      </div>

      {mine.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-bold text-heading">Your reviews</h2>
          <ul className="divide-y divide-line">
            {mine.map((r) => (
              <li key={r._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Stars value={r.rating} />
                  <p className="mt-1 line-clamp-2 text-sm text-fg">{r.text}</p>
                  <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                </div>
                <Badge status={r.status === "Pending" ? "Waiting for approval" : r.status === "Approved" ? "Published" : "Not published"} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="card">
          <EmptyState icon={MessageSquareQuote} title="No reviews yet" text="Happy with our work? A short review helps other businesses choose us." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <figure key={i} className="card flex flex-col p-5">
              <div className="flex items-center justify-between">
                <Stars value={r.rating} />
                <Quote className="h-5 w-5 text-brand/30" />
              </div>
              <blockquote className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">&ldquo;{r.text}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-bold text-heading">{r.name}</span>
                {r.company && <span className="text-muted"> · {r.company}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
