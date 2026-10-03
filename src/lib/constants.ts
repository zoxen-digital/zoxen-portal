export const QUERY_STATUSES = ["Pending", "In Progress", "Completed", "Closed"] as const;
export const QUERY_PRIORITIES = ["Low", "Medium", "High"] as const;
export const CLIENT_STATUSES = ["Active", "Onboarding", "Inactive"] as const;
export const INVOICE_STATUSES = ["Draft", "Unpaid", "Partially Paid", "Paid", "Cancelled"] as const;
export const ONBOARDING_STATUSES = ["New", "Reviewed", "Converted", "Rejected"] as const;

export const PROJECT_STAGES = [
  "Onboarding",
  "Approved",
  "In Progress",
  "Internal Review",
  "Client Review",
  "Revision",
  "Launch",
  "Live",
  "Completed",
  "On Hold",
  "Blocked",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

/** What the client sees for each internal stage, and the default progress for it. */
export const STAGE_INFO: Record<ProjectStage, { client: string; progress: number }> = {
  Onboarding: { client: "Onboarding", progress: 5 },
  Approved: { client: "Getting Started", progress: 10 },
  "In Progress": { client: "In Progress", progress: 40 },
  "Internal Review": { client: "In Progress", progress: 65 },
  "Client Review": { client: "Ready for Your Review", progress: 75 },
  Revision: { client: "Revisions in Progress", progress: 80 },
  Launch: { client: "Preparing Launch", progress: 90 },
  Live: { client: "Live", progress: 100 },
  Completed: { client: "Completed", progress: 100 },
  "On Hold": { client: "On Hold", progress: 0 },
  Blocked: { client: "In Progress", progress: 0 },
};

/** The main road a project travels, shown as a timeline. On Hold / Blocked sit outside it. */
export const STAGE_PATH: ProjectStage[] = ["Onboarding", "Approved", "In Progress", "Client Review", "Launch", "Live", "Completed"];
export const OPEN_STAGES: ProjectStage[] = PROJECT_STAGES.filter((s) => !["Live", "Completed"].includes(s));

export const ISSUE_STATUSES = ["Open", "Resolved"] as const;
export const REVISION_STATUSES = ["Requested", "In Progress", "Done"] as const;

export const DEFAULT_CHECKLIST: Record<string, string[]> = {
  website: [
    "Content and logo received",
    "Design approved",
    "Pages developed",
    "Mobile responsive check",
    "Forms tested",
    "SEO basics (titles, meta, sitemap)",
    "Domain connected",
    "SSL active",
    "Speed check",
  ],
  other: ["Brief received", "First draft", "Client review", "Final delivery"],
};

export const SERVICES = [
  "Website Development",
  "Website Redesign",
  "E-commerce Development",
  "App Development",
  "UI/UX Design",
  "Brand Identity",
  "Logo Design",
  "SEO",
  "Meta Ads",
  "Google Ads",
  "Social Media Management",
  "Content Creation",
  "Video Editing",
  "Videography",
  "CRM & Automation",
  "Other",
];

export const CLIENT_SOURCES = [
  "Manual",
  "Onboarding Form",
  "Referral",
  "Meta Ads",
  "Google Ads",
  "Website",
  "WhatsApp",
  "Other",
];

export const CURRENCIES = ["PKR", "USD", "CAD", "GBP", "AED", "EUR", "SAR"];

export const ITEM_PRESETS = [
  { description: "Website Design & Development", details: "Custom design, responsive, SEO setup", unit: "Website", rate: 0 },
  { description: "Extra Pages", details: "Additional inner pages", unit: "Pages", rate: 0 },
  { description: "Domain & Hosting", details: "1 year domain and premium hosting", unit: "Year", rate: 0 },
  { description: "Logo Design", details: "Professional logo design with source files", unit: "", rate: 0 },
  { description: "SEO Setup", details: "On-page SEO, sitemap, Google Search Console", unit: "", rate: 0 },
  { description: "Monthly Maintenance", details: "Updates, backups and support", unit: "Month", rate: 0 },
];
