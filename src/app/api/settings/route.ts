import { ADMIN, apiUser } from "@/lib/session";
import { dbConnect } from "@/lib/db";
import { Settings } from "@/models/Settings";
import { handle, json, pick } from "@/lib/api";
import { clearSettingsCache, getSettings } from "@/lib/settings";

const FIELDS = [
  "companyName",
  "tagline",
  "email",
  "phone",
  "website",
  "address",
  "invoicePrefix",
  "defaultCurrency",
  "defaultTaxPercent",
  "defaultDueDays",
  "defaultNotes",
  "defaultTerms",
  "paymentDetails",
  "teamMembers",
  "meetingLink",
  "contractTemplate",
  "referralReward",
];

export const GET = handle(async () => {
  await apiUser(ADMIN);
  return json(await getSettings());
});

export const PUT = handle(async (req: Request) => {
  await apiUser(ADMIN);
  await dbConnect();
  const data = pick(await req.json(), FIELDS);
  if ("defaultTaxPercent" in data) data.defaultTaxPercent = Number(data.defaultTaxPercent) || 0;
  if ("defaultDueDays" in data) data.defaultDueDays = Number(data.defaultDueDays) || 0;
  if ("invoicePrefix" in data) {
    data.invoicePrefix = String(data.invoicePrefix || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || "INV";
  }
  if (Array.isArray(data.teamMembers)) {
    data.teamMembers = (data.teamMembers as unknown[]).map((t) => String(t).trim()).filter(Boolean);
  }
  const settings = await Settings.findOneAndUpdate({ key: "main" }, data, { new: true, upsert: true }).lean();
  clearSettingsCache();
  return json(settings);
});
