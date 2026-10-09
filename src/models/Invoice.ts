// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

const ItemSchema = new Schema(
  {
    description: { type: String, required: true },
    details: String,
    qty: { type: Number, default: 1 },
    unit: String,
    rate: { type: Number, default: 0 },
  },
  { _id: false }
);

const ExtraSchema = new Schema({ label: String, amount: { type: Number, default: 0 } }, { _id: false });

const PaymentSchema = new Schema(
  { amount: { type: Number, required: true }, date: { type: Date, default: Date.now }, method: String, note: String },
  { _id: false }
);

const InvoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    publicId: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    query: { type: Schema.Types.ObjectId, ref: "Query" },
    clientSnapshot: { name: String, company: String, email: String, phone: String, address: String },
    requirement: { summary: String, websites: Number, pages: Number, tags: [String] },
    items: [ItemSchema],
    extraCosts: [ExtraSchema],
    discountType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    discountValue: { type: Number, default: 0 },
    discountLabel: String,
    taxPercent: { type: Number, default: 0 },
    currency: { type: String, default: "PKR" },
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    status: { type: String, default: "Unpaid", index: true },
    payments: [PaymentSchema],
    notes: String,
    terms: String,
    paymentDetails: { bankName: String, accountName: String, accountNumber: String, iban: String, other: String },
    totals: {
      itemsTotal: Number,
      extrasTotal: Number,
      subtotal: Number,
      discount: Number,
      tax: Number,
      total: Number,
      paid: Number,
      balance: Number,
    },
    viewCount: { type: Number, default: 0 },
    lastViewedAt: Date,
    confirmedAt: Date,
    lastReminderAt: Date,
    reminderCount: { type: Number, default: 0 },
    // Automatic overdue reminders already sent: 1 = after 3 days, 2 = after 7 days, 3 = after 14 days.
    autoReminderStage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Invoice: Model<any> = models.Invoice || model("Invoice", InvoiceSchema);
