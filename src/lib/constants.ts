export const QUERY_STATUSES = ["Pending", "In Progress", "Completed", "Closed"] as const;
export const QUERY_PRIORITIES = ["Low", "Medium", "High"] as const;
export const CLIENT_STATUSES = ["Active", "Onboarding", "Inactive"] as const;
export const INVOICE_STATUSES = ["Draft", "Unpaid", "Partially Paid", "Paid", "Cancelled"] as const;
export const ONBOARDING_STATUSES = ["New", "Reviewed", "Converted", "Rejected"] as const;

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
