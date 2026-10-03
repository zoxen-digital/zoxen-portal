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
  },
  { timestamps: true }
);

ClientSchema.index({ name: "text", company: "text", email: "text" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Client: Model<any> = models.Client || model("Client", ClientSchema);
