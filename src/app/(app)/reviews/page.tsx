import Link from "next/link";
import { MessageSquareQuote, Pin, Star } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { ADMIN, pageUser } from "@/lib/session";
import { Review } from "@/models/Review";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { StatusTabs } from "@/components/Filters";
import { ReviewAdminActions, Stars } from "@/components/Reviews";
import { formatDate, serialize } from "@/lib/utils";
import type { ClientT, ReviewT } from "@/lib/types";

export const metadata = { title: "Client Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageUser(ADMIN);
  const sp = await searchParams;
  await dbConnect();
  const [docs, all] = await Promise.all([
    Review.find(sp.status ? { status: sp.status } : {}).sort({ featured: -1, createdAt: -1 }).limit(500).populate("client", "name company").lean(),
    Review.find().select("status rating").lean<{ status: string; rating: number }[]>(),
  ]);
  const reviews = serialize<ReviewT[]>(docs);
  const counts: Record<string, number> = { All: all.length };
  for (const r of all) counts[r.status] = (counts[r.status] || 0) + 1;
  const approved = all.filter((r) => r.status === "Approved");
  const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;

  return (
    <div>
      <PageHeader
        title="Client Reviews"
        subtitle="Clients write reviews from their portal. Approved reviews are shown to every client and on the onboarding form."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={MessageSquareQuote} label="Waiting for approval" value={counts.Pending || 0} tone={counts.Pending ? "amber" : "slate"} href="/reviews?status=Pending" />
        <StatCard icon={Star} label="Approved reviews" value={approved.length} tone="green" href="/reviews?status=Approved" />
        <StatCard icon={Star} label="Average rating" value={avg ? `${avg.toFixed(1)} / 5` : "—"} tone="violet" />
      </div>
      <div className="mb-4">
        <StatusTabs basePath="/reviews" current={sp.status} options={["Pending", "Approved", "Rejected"]} params={sp} counts={counts} />
      </div>
      {reviews.length === 0 ? (
        <div className="card">
          <EmptyState icon={MessageSquareQuote} title="No reviews here" text="Clients can write a review from the Reviews page in their portal." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.map((r) => {
            const c = r.client as ClientT | null;
            return (
              <div key={r._id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Stars value={r.rating} />
                    <div className="mt-1 text-sm font-bold text-heading">
                      {r.name}
                      {r.company && <span className="font-normal text-muted"> · {r.company}</span>}
                    </div>
                    <div className="text-xs text-muted">
                      {c ? (
                        <Link href={`/clients/${c._id}`} className="hover:text-brand">Client: {c.company || c.name}</Link>
                      ) : (
                        "Deleted client"
                      )}{" "}
                      · {formatDate(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.featured && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet">
                        <Pin className="h-3 w-3" /> Pinned
                      </span>
                    )}
                    <Badge status={r.status} />
                  </div>
                </div>
                <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">&ldquo;{r.text}&rdquo;</p>
                <div className="mt-4 border-t border-line pt-3">
                  <ReviewAdminActions id={r._id} status={r.status} featured={r.featured} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
