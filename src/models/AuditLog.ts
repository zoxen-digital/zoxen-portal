// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/** Who did what, when, from where. Append-only: nothing in the app edits or deletes it. Kept 1 year. */
const AuditLogSchema = new Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorName: String,
    actorRole: String,
    action: { type: String, index: true },
    category: { type: String, index: true },
    method: String,
    path: String,
    target: String,
    details: String,
    ip: String,
    status: Number,
    batch: String,
  },
  { versionKey: false }
);
AuditLogSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AuditLog: Model<any> = models.AuditLog || model("AuditLog", AuditLogSchema);
