import { Schema, model, models, type Model } from "mongoose";

const ItemSchema = new Schema(
  { description: { type: String, required: true }, details: String, qty: { type: Number, default: 1 }, unit: String, rate: { type: Number, default: 0 } },
  { _id: false }
);

/** A ready-made service (e.g. "5-page website") with prices, checklist and timeline. */
const PackageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    service: { type: String, trim: true },
    description: String,
    items: { type: [ItemSchema], default: [] },
    currency: { type: String, default: "PKR" },
    checklist: { type: [String], default: [] },
    revisionLimit: { type: Number, default: 2 },
    durationDays: { type: Number, default: 14 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export { ItemSchema };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Package: Model<any> = models.Package || model("Package", PackageSchema);
