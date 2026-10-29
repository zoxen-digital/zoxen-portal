// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, Types, model, models, type Model } from "mongoose";

export const FINDER_STATUSES = ["new", "done", "no"] as const;

/** A business found by Lead Finder: just name, number and website, worked by WhatsApp. */
const FinderLeadSchema = new Schema(
  {
    /** Who searched for it; each person only sees their own leads. */
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceKey: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    address: { type: String, default: "" },
    category: { type: String, default: "" },
    city: { type: String, default: "" },
    status: { type: String, enum: FINDER_STATUSES, default: "new" },
    statusBy: { type: String, default: "" },
    statusAt: { type: Date, default: null },
  },
  { timestamps: true }
);

FinderLeadSchema.index({ owner: 1, sourceKey: 1 }, { unique: true });
FinderLeadSchema.index({ owner: 1, status: 1, createdAt: -1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FinderLead: Model<any> = models.FinderLead || model("FinderLead", FinderLeadSchema);

/** Leads a person may see: their own. Leads saved before owners existed belong to the super admin who found them. */
export function ownerFilter(user: { id: string; role: string }) {
  const owner = new Types.ObjectId(user.id);
  return user.role === "super_admin" ? { $or: [{ owner }, { owner: { $exists: false } }] } : { owner };
}
