// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/** Every sign-in attempt (success or failure), for login history and new-device alerts. Kept 1 year. */
const LoginEventSchema = new Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    email: String,
    name: String,
    role: String,
    success: Boolean,
    ip: String,
    country: String,
    city: String,
    device: String,
    userAgent: String,
    newDevice: Boolean,
  },
  { versionKey: false }
);
LoginEventSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LoginEvent: Model<any> = models.LoginEvent || model("LoginEvent", LoginEventSchema);
