import { Schema, model, models, type Model } from "mongoose";

const SettingsSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    companyName: { type: String, default: "Zoxen Digital" },
    tagline: { type: String, default: "Websites. Branding. Digital Growth." },
    email: String,
    phone: String,
    website: String,
    address: String,
    invoicePrefix: { type: String, default: "ZD" },
    defaultCurrency: { type: String, default: "PKR" },
    defaultTaxPercent: { type: Number, default: 0 },
    defaultDueDays: { type: Number, default: 7 },
    defaultNotes: { type: String, default: "Thank you for choosing Zoxen Digital! We appreciate your trust." },
    defaultTerms: {
      type: String,
      default: "50% advance is required to start the project. Remaining balance is due before final delivery.",
    },
    paymentDetails: { bankName: String, accountName: String, accountNumber: String, iban: String, other: String },
    teamMembers: { type: [String], default: [] },
    // Backup meeting room (e.g. a permanent Google Meet link) used when Google Calendar is not connected.
    meetingLink: String,
    // Starting text for new contracts. Empty = built-in template.
    contractTemplate: String,
    // What a client gets for a referral that becomes a project (shown on their Refer & Earn page).
    referralReward: { type: String, default: "10% off your next invoice for every friend who starts a project with us." },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Settings: Model<any> = models.Settings || model("Settings", SettingsSchema);
