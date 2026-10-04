import { Schema, model, models, type Model } from "mongoose";

const OnboardingSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    website: { type: String, trim: true },
    services: [String],
    budget: String,
    message: String,
    data: { type: Schema.Types.Mixed },
    status: { type: String, default: "New", index: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", index: true },
    // "portal" = filled on our own onboarding form; "external" = sent by another website.
    source: { type: String, default: "external" },
    project: { type: Schema.Types.ObjectId, ref: "Project" },
    approvedAt: Date,
    approvedBy: String,
    // Client whose referral link brought this lead.
    referredBy: { type: Schema.Types.ObjectId, ref: "Client" },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Onboarding: Model<any> = models.Onboarding || model("Onboarding", OnboardingSchema);
