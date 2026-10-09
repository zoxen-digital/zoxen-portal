// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";
import { ItemSchema } from "./Package";

const ExtraSchema = new Schema({ label: String, amount: { type: Number, default: 0 } }, { _id: false });

/** A proposal the client can accept online. Accepting creates the invoice and the project. */
const QuoteSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    publicId: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    title: { type: String, required: true, trim: true },
    intro: String,
    items: { type: [ItemSchema], default: [] },
    extraCosts: { type: [ExtraSchema], default: [] },
    discountType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    discountValue: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    currency: { type: String, default: "PKR" },
    validUntil: Date,
    notes: String,
    terms: String,
    status: { type: String, default: "Draft", index: true },
    totals: { itemsTotal: Number, extrasTotal: Number, subtotal: Number, discount: Number, tax: Number, total: Number },
    package: { type: Schema.Types.ObjectId, ref: "Package" },
    // What to set up when the client accepts.
    projectSetup: {
      service: String,
      checklist: [String],
      revisionLimit: { type: Number, default: 2 },
      durationDays: { type: Number, default: 14 },
    },
    sentAt: Date,
    viewedAt: Date,
    acceptedAt: Date,
    acceptedName: String,
    acceptedIp: String,
    acceptedUA: String,
    declinedAt: Date,
    declineReason: String,
    invoice: { type: Schema.Types.ObjectId, ref: "Invoice" },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Quote: Model<any> = models.Quote || model("Quote", QuoteSchema);
