// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";
import { ItemSchema } from "./Package";

/** A bill that repeats (maintenance, SEO, ads management). The daily job turns it into invoices. */
const RecurringPlanSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    title: { type: String, required: true, trim: true },
    items: { type: [ItemSchema], default: [] },
    discountType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    discountValue: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    currency: { type: String, default: "PKR" },
    interval: { type: String, enum: ["monthly", "quarterly", "yearly"], default: "monthly" },
    nextRunAt: { type: Date, required: true, index: true },
    dueDays: { type: Number, default: 7 },
    notes: String,
    terms: String,
    active: { type: Boolean, default: true },
    lastRunAt: Date,
    lastInvoice: { type: Schema.Types.ObjectId, ref: "Invoice" },
    invoicesCreated: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const RecurringPlan: Model<any> = models.RecurringPlan || model("RecurringPlan", RecurringPlanSchema);
