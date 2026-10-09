// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

export const EXPENSE_CATEGORIES = ["Domain", "Hosting", "Database", "Email", "Software", "Ads", "Salary", "Office", "Other"] as const;
export const EXPENSE_CYCLES = ["One-time", "Monthly", "Yearly"] as const;

/** A business cost: a one-time purchase, or a subscription that renews monthly or yearly. */
const ExpenseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "Other" },
    vendor: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PKR" },
    cycle: { type: String, enum: EXPENSE_CYCLES, default: "Monthly" },
    /** Paid on (one-time) or started on (subscription). */
    date: { type: Date, default: Date.now },
    /** Next renewal for subscriptions; a reminder goes out 7 days before. */
    renewsOn: { type: Date, default: null },
    /** Optional: a cost bought for a specific client (e.g. their domain). */
    client: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    notes: { type: String, default: "" },
    /** Stopped subscriptions stay on record but no longer count in running costs. */
    active: { type: Boolean, default: true },
    reminderFor: { type: Date, default: null },
  },
  { timestamps: true }
);

ExpenseSchema.index({ active: 1, renewsOn: 1 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Expense: Model<any> = models.Expense || model("Expense", ExpenseSchema);
