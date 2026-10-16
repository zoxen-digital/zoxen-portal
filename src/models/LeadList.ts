// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/** One uploaded sheet of outreach leads (e.g. a LinkedIn export). */
const LeadListSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    source: { type: String, default: "LinkedIn" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdByName: String,
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LeadList: Model<any> = models.LeadList || model("LeadList", LeadListSchema);
