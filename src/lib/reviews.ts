import { dbConnect } from "./db";
import { Review } from "@/models/Review";

export type PublicReview = { name: string; company?: string; rating: number; text: string };

/** Approved reviews for clients and the onboarding form: pinned first, then newest. */
export async function approvedReviews(limit = 30): Promise<PublicReview[]> {
  await dbConnect();
  const docs = await Review.find({ status: "Approved" })
    .sort({ featured: -1, approvedAt: -1 })
    .limit(limit)
    .select("name company rating text")
    .lean<PublicReview[]>();
  return docs.map((r) => ({ name: r.name, company: r.company || undefined, rating: r.rating, text: r.text }));
}
