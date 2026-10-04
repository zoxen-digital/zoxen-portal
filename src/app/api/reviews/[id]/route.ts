import { dbConnect } from "@/lib/db";
import { Review } from "@/models/Review";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { clientUserIds, notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

/** { action: "approve" | "reject" | "feature" | "unfeature" } */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Review not found", 404);
  const { action } = await req.json().catch(() => ({}));
  await dbConnect();
  const review = await Review.findById(id);
  if (!review) return error("Review not found", 404);
  const wasApproved = review.status === "Approved";

  if (action === "approve") review.set({ status: "Approved", approvedAt: review.approvedAt || new Date(), approvedBy: user.name });
  else if (action === "reject") review.set({ status: "Rejected", featured: false });
  else if (action === "feature" || action === "unfeature") {
    if (review.status !== "Approved") return error("Approve the review first");
    review.featured = action === "feature";
  } else return error("Unknown action");
  await review.save();

  if (!wasApproved && review.status === "Approved") {
    await notify(await clientUserIds(String(review.client)), {
      title: "Thank you! Your review is live",
      body: "Your review now helps other businesses choose us. We really appreciate it.",
      link: "/portal/reviews",
    });
  }
  return json(review);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Review not found", 404);
  await dbConnect();
  await Review.findByIdAndDelete(id);
  return json({ ok: true });
});
