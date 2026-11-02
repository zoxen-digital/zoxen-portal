// Must load before the schema below is compiled (recycle bin for deletions).
import "@/lib/trash-plugin";
import { Schema, model, models, type Model } from "mongoose";

/** Industries shown as filters on demo.zoxendigital.com (the URL slug is made from the name). */
export const DEMO_INDUSTRIES = [
  "Restaurant & Food",
  "Auto Services",
  "Cleaning",
  "Home Services & Renovation",
  "Real Estate",
  "Health & Wellness",
  "Beauty & Fashion",
  "Fitness & Sports",
  "Logistics & Transport",
  "Legal & Finance",
  "Events & Photography",
  "Retail & E-commerce",
  "Nonprofit & Community",
  "Politics",
  "Education & Coaching",
  "Media & Entertainment",
  "Tech & Consulting",
  "Travel & Hospitality",
  "Pets",
  "Other",
] as const;

export const industrySlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** One portfolio website shown on the public demo page. */
const DemoSiteSchema = new Schema(
  {
    url: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    industry: { type: String, enum: DEMO_INDUSTRIES, default: "Other", index: true },
    description: { type: String, default: "" },
    /** Hidden sites stay in the list but are not shown publicly. */
    visible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DemoSite: Model<any> = models.DemoSite || model("DemoSite", DemoSiteSchema);
