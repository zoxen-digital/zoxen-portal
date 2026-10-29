// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

export const FINDER_STATUSES = ["new", "done", "no"] as const;

/** A business found by Lead Finder: just name, number and website, worked by WhatsApp. */
const FinderLeadSchema = new Schema(
  {
    sourceKey: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    address: { type: String, default: "" },
    category: { type: String, default: "" },
    city: { type: String, default: "" },
    status: { type: String, enum: FINDER_STATUSES, default: "new", index: true },
    statusBy: { type: String, default: "" },
    statusAt: { type: Date, default: null },
  },
  { timestamps: true }
);

FinderLeadSchema.index({ category: 1, city: 1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FinderLead: Model<any> = models.FinderLead || model("FinderLead", FinderLeadSchema);
