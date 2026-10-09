import { Schema, model, models, type Model } from "mongoose";

/** A deleted document, kept 30 days so the owner can restore it. Written by lib/trash-plugin. */
const TrashItemSchema = new Schema(
  {
    model: String,
    collectionName: String,
    docId: Schema.Types.Mixed,
    label: String,
    data: Schema.Types.Mixed,
    // Everything deleted by the same request (e.g. a client and its projects) shares a batch.
    batch: { type: String, index: true },
    deletedBy: String,
    deletedByRole: String,
    deletedAt: { type: Date, default: Date.now },
    restoredAt: Date,
    restoredBy: String,
  },
  { collection: "trashitems" }
);
TrashItemSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TrashItem: Model<any> = models.TrashItem || model("TrashItem", TrashItemSchema);
