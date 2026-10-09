// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

const ClientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    source: { type: String, default: "Manual" },
    status: { type: String, default: "Active" },
    notes: { type: String },
    // Secret part of this client personal onboarding form link (/onboarding/<token>).
    onboardingToken: { type: String, unique: true, sparse: true },
    /** Set when the first invoice is fully paid: the client can then fill the onboarding form in the portal. */
    onboardingUnlockedAt: { type: Date, default: null },
    // Half-filled onboarding form from their personal link, so they can continue on any device.
    onboardingDraft: { data: Schema.Types.Mixed, savedAt: Date },
    // Code in this client referral link (/onboarding?ref=<code>).
    referralCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

ClientSchema.index({ name: "text", company: "text", email: "text" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Client: Model<any> = models.Client || model("Client", ClientSchema);
