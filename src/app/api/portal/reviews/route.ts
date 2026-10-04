import { dbConnect } from "@/lib/db";
import { Review } from "@/models/Review";
import { Client } from "@/models/Client";
import { error, handle, json } from "@/lib/api";
import { apiUser } from "@/lib/session";
import { notify, superAdminIds } from "@/lib/notify";

/** Client writes a review. It stays hidden until the team approves it. Body: { rating, text, name?, company? } */
export const POST = handle(async (req: Request) => {
  const user = await apiUser(["client"]);
  const b = await req.json().catch(() => ({}));
  const rating = Math.round(Number(b.rating));
  if (!(rating >= 1 && rating <= 5)) return error("Choose a rating from 1 to 5 stars");
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (text.length < 10) return error("Please write at least a sentence about your experience");
  await dbConnect();
  if ((await Review.countDocuments({ client: user.clientId, status: "Pending" })) >= 3) {
    return error("You already have reviews waiting for approval. Thank you!");
  }
  const client = await Client.findById(user.clientId).select("company").lean<{ company?: string }>();
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, 80) : user.name;
  const company = typeof b.company === "string" ? b.company.trim().slice(0, 120) : client?.company || "";
  const review = await Review.create({ client: user.clientId, author: user.id, name, company, rating, text: text.slice(0, 2000), status: "Pending" });
  await notify(await superAdminIds(), {
    title: `New ${rating}-star review from ${company || name}`,
    body: text.slice(0, 140),
    link: "/reviews",
  });
  return json(review, 201);
});
