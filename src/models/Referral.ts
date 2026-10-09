// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/**
 * A lead that came through a client's referral link.
 * Submitted -> Converted (form approved) -> Rewarded (you gave the reward), or Not converted (rejected).
 */
const ReferralSchema = new Schema(
  {
    referrer: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    onboarding: { type: Schema.Types.ObjectId, ref: "Onboarding", required: true, unique: true },
    leadName: String,
    leadCompany: String,
    leadEmail: String,
    status: { type: String, default: "Submitted", index: true },
    newClient: { type: Schema.Types.ObjectId, ref: "Client" },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    convertedAt: Date,
    rewardNote: String,
    rewardedAt: Date,
    rewardedBy: String,
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Referral: Model<any> = models.Referral || model("Referral", ReferralSchema);
