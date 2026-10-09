// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/** A client testimonial. Shown to other clients only after the team approves it. */
const ReviewSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true },
    status: { type: String, default: "Pending", index: true },
    approvedAt: Date,
    approvedBy: String,
    // Pinned reviews show first.
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Review: Model<any> = models.Review || model("Review", ReviewSchema);
