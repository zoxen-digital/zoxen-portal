/** Options and fields of the client onboarding form (same as the original Orbit X form). */

export const OB_PACKAGES = [
  { id: "Standard", price: "$99", desc: "Up to 5 pages, contact form, mobile responsive." },
  { id: "Premium", price: "$199", desc: "Up to 12 pages, admin portal, booking form.", popular: true },
  { id: "Advanced", price: "$499", desc: "Up to 15 pages, eCommerce, automation." },
];

export const OB_ADD_ONS = [
  "Logo Design", "Domain Purchase & Setup", "Business Email Setup", "CRM Integration",
  "Copywriting", "Additional Pages", "Blog Setup", "Payment Gateway Setup",
  "Chatbot Integration", "Advanced SEO Package", "Social Media Setup", "Google Business Profile Setup",
];

export const OB_MAIN_GOALS = ["Generate Leads", "Increase Sales", "Get Appointments", "Build Brand Awareness", "Showcase Portfolio", "Collect Customer Info"];

export const OB_PAGE_OPTIONS = ["Home", "About", "Services", "Contact", "Gallery", "Testimonials", "FAQ", "Pricing", "Blog", "Products", "Booking", "Team"];

export const OB_INDUSTRIES = [
  "Retail & E-commerce", "Restaurant & Food", "Health & Wellness", "Construction & Renovation",
  "Professional Services", "Real Estate", "Automotive", "Non-Profit & Community", "Education", "Other",
];

export const OB_BUSINESS_SIZES = ["Just me", "2-10 employees", "11-50 employees", "50+ employees"];

export const OB_LOGO_STATUS = ["I have a logo", "I need a logo designed"];

export const OB_STEP_LABELS = ["Basic Info", "Goals", "Features", "Design", "Content", "Review"];
export const OB_STEP_TITLES = ["Basic Information", "Project Goals", "Features & Pages", "Design Preferences", "Content Details", "Review & Submit"];

/** Text fields of the form, in order. */
export const OB_TEXT_FIELDS = [
  "contactPerson", "email", "phone",
  "businessName", "currentWebsite", "industry", "businessSize", "socialMedia",
  "mainGoal", "targetAudience",
  "logoStatus", "designStyle", "brandColors", "inspirationWebsites",
  "homepageHeadline", "businessDescription", "servicesList", "contactDetails",
  "pricingDisplay", "productPricingInfo", "specialOffers", "notes",
] as const;

export type ObTextField = (typeof OB_TEXT_FIELDS)[number];

export type OnboardingAnswers = Record<ObTextField, string> & {
  package: string;
  addOns: string[];
  pagesNeeded: string[];
  logoUrl?: string | null;
  attachmentUrls?: string[];
};

/** Labels for showing a submission, grouped like the form. */
export const OB_SECTIONS: { title: string; fields: [keyof OnboardingAnswers, string][] }[] = [
  { title: "Your Information", fields: [["contactPerson", "Full Name"], ["email", "Email Address"], ["phone", "Phone Number"]] },
  {
    title: "Business Information",
    fields: [["businessName", "Business Name"], ["currentWebsite", "Website"], ["industry", "Industry / Niche"], ["businessSize", "Business Size"], ["socialMedia", "Social Media Links"]],
  },
  { title: "Package & Goals", fields: [["package", "Package"], ["mainGoal", "Main Goal"], ["targetAudience", "Target Audience"]] },
  { title: "Features & Pages", fields: [["addOns", "Add-Ons"], ["pagesNeeded", "Pages Needed"]] },
  {
    title: "Design Preferences",
    fields: [["logoStatus", "Logo"], ["designStyle", "Design Style"], ["brandColors", "Brand Colors"], ["inspirationWebsites", "Inspiration Websites"]],
  },
  {
    title: "Content Details",
    fields: [
      ["homepageHeadline", "Homepage Headline"],
      ["businessDescription", "Business Description"],
      ["servicesList", "Services List"],
      ["contactDetails", "Contact Page Details"],
      ["pricingDisplay", "Pricing Display Preference"],
      ["productPricingInfo", "Product / Pricing Info"],
      ["specialOffers", "Special Offers or Packages"],
      ["notes", "Additional Notes"],
    ],
  },
];

export function packagePrice(id?: string) {
  return OB_PACKAGES.find((p) => p.id === id)?.price || "";
}
