// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

const PushSubSchema = new Schema(
  { endpoint: String, keys: { p256dh: String, auth: String }, createdAt: { type: Date, default: Date.now } },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    role: { type: String, enum: ["agent", "super_admin", "team_admin", "client"], required: true, index: true },
    // Bumped to sign the user out everywhere (force logout, disable, password change by the owner).
    sessionVersion: { type: Number, default: 0 },
    // Only for role "client": the client company this login belongs to.
    client: { type: Schema.Types.ObjectId, ref: "Client", index: true },
    title: { type: String, trim: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ["invited", "active", "disabled"], default: "invited" },
    passwordHash: { type: String, select: false },
    inviteTokenHash: { type: String, select: false, index: true },
    inviteExpires: { type: Date, select: false },
    lastLoginAt: Date,
    pushSubscriptions: { type: [PushSubSchema], default: [], select: false },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const User: Model<any> = models.User || model("User", UserSchema);
