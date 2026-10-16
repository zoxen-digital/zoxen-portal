// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

export const LEAD_STATUSES = ["Pending", "Responded", "Interested", "Call later", "Not interested"] as const;

/** One person on an outreach sheet: did we message them, and what happened next. */
const LeadSchema = new Schema(
  {
    list: { type: Schema.Types.ObjectId, ref: "LeadList", required: true, index: true },
    name: { type: String, default: "" },
    company: { type: String, default: "" },
    title: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    location: { type: String, default: "" },
    website: { type: String, default: "" },
    /** Any other columns from the sheet, kept as they were. */
    extra: { type: Map, of: String, default: {} },
    messaged: { type: Boolean, default: false },
    messagedAt: { type: Date, default: null },
    messagedBy: { type: String, default: "" },
    status: { type: String, enum: LEAD_STATUSES, default: "Pending" },
    followUpAt: { type: Date, default: null },
    followUpNotified: { type: Date, default: null },
    notes: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    /** Set when the lead was added to Queries. */
    query: { type: Schema.Types.ObjectId, ref: "Query", default: null },
  },
  { timestamps: true }
);

LeadSchema.index({ list: 1, messaged: 1, status: 1 });
LeadSchema.index({ status: 1, followUpAt: 1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Lead: Model<any> = models.Lead || model("Lead", LeadSchema);
