import { dbConnect } from "./db";
import { Settings } from "@/models/Settings";
import { serialize } from "./utils";
import type { SettingsT } from "./types";

// Settings rarely change, so keep them in memory instead of querying on every page.
// Stored on globalThis so pages and API routes share the same cache.
const TTL_MS = 5 * 60 * 1000;
const g = globalThis as unknown as { _zxSettings?: { value: SettingsT; at: number } };

export function clearSettingsCache() {
  g._zxSettings = undefined;
}

export async function getSettings(): Promise<SettingsT> {
  if (g._zxSettings && Date.now() - g._zxSettings.at < TTL_MS) return g._zxSettings.value;

  await dbConnect();
  let doc = await Settings.findOne({ key: "main" }).lean();
  if (!doc) doc = (await Settings.create({ key: "main" })).toObject();
  const s = serialize<SettingsT>(doc);
  s.paymentDetails = s.paymentDetails || {};
  s.teamMembers = s.teamMembers || [];
  g._zxSettings = { value: s, at: Date.now() };
  return s;
}
