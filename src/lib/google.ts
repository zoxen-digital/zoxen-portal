import { dbConnect } from "./db";
import { notify, superAdminIds } from "./notify";
import { getSettings } from "./settings";
import { Integration } from "@/models/Integration";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    // offline + consent = Google always returns a refresh token.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error_description || data.error || "Google sign-in failed"), { code: data.error });
  return data as { access_token: string; expires_in: number; refresh_token?: string; id_token?: string };
}

/** Exchanges the OAuth code and stores the connection. */
export async function saveGoogleConnection(code: string, redirectUri: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
  if (!t.refresh_token) throw new Error("Google did not return a refresh token. Remove the app from your Google account permissions and connect again.");
  let email = "";
  if (t.id_token) {
    try {
      email = JSON.parse(Buffer.from(t.id_token.split(".")[1]!, "base64url").toString()).email || "";
    } catch {}
  }
  await dbConnect();
  await Integration.findOneAndUpdate(
    { key: "google" },
    {
      email,
      refreshToken: t.refresh_token,
      accessToken: t.access_token,
      accessTokenExpires: new Date(Date.now() + (t.expires_in - 60) * 1000),
      status: "connected",
      connectedAt: new Date(),
      lastError: "",
    },
    { upsert: true }
  );
  return email;
}

export async function googleStatus() {
  await dbConnect();
  const g = await Integration.findOne({ key: "google" }).select("email status connectedAt lastError").lean<{
    email?: string;
    status: string;
    connectedAt?: Date;
    lastError?: string;
  }>();
  return {
    configured: googleConfigured(),
    connected: g?.status === "connected",
    email: g?.email || "",
    connectedAt: g?.connectedAt ? new Date(g.connectedAt).toISOString() : null,
    lastError: g?.lastError || "",
  };
}

export async function disconnectGoogle() {
  await dbConnect();
  const g = await Integration.findOne({ key: "google" });
  if (!g) return;
  if (g.refreshToken) {
    // Best effort: also revoke on Google's side.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(g.refreshToken)}`, { method: "POST" }).catch(() => {});
  }
  g.set({ status: "disconnected", refreshToken: undefined, accessToken: undefined, accessTokenExpires: undefined, lastError: "" });
  await g.save();
}

/** A valid access token, or null when Google is not connected (or the connection was revoked/expired). */
async function accessToken() {
  if (!googleConfigured()) return null;
  await dbConnect();
  const g = await Integration.findOne({ key: "google", status: "connected" });
  if (!g?.refreshToken) return null;
  if (g.accessToken && g.accessTokenExpires && g.accessTokenExpires.getTime() > Date.now()) return g.accessToken as string;
  try {
    const t = await tokenRequest({ refresh_token: g.refreshToken, grant_type: "refresh_token" });
    g.accessToken = t.access_token;
    g.accessTokenExpires = new Date(Date.now() + (t.expires_in - 60) * 1000);
    await g.save();
    return t.access_token;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "invalid_grant") {
      // Testing-mode apps expire after 7 days, or access was removed: tell the owner once.
      g.set({ status: "disconnected", refreshToken: undefined, accessToken: undefined, lastError: "Google connection expired" });
      await g.save();
      await notify(await superAdminIds(), {
        title: "Google Calendar disconnected",
        body: "Meeting links now use your fixed meeting link. Reconnect Google in Settings to create Meet links again.",
        link: "/settings",
      });
    }
    console.error("Google token refresh failed:", e);
    return null;
  }
}

type EventInput = { title: string; start: Date; minutes: number; description?: string; attendees: string[] };

function eventBody(e: EventInput) {
  return {
    summary: e.title,
    description: e.description || "",
    start: { dateTime: e.start.toISOString() },
    end: { dateTime: new Date(e.start.getTime() + e.minutes * 60_000).toISOString() },
    attendees: [...new Set(e.attendees.filter(Boolean).map((a) => a.toLowerCase()))].map((email) => ({ email })),
    reminders: { useDefault: true },
  };
}

/**
 * Creates a Google Calendar event with a Meet link and emails the invite to attendees.
 * Falls back to the fixed meeting link from Settings when Google is not connected or fails.
 */
export async function createMeeting(e: EventInput): Promise<{ link: string; eventId?: string; source: "google" | "fixed" | "none" }> {
  const token = await accessToken();
  if (token) {
    try {
      const res = await fetch(`${CAL}?conferenceDataVersion=1&sendUpdates=all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...eventBody(e),
          conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Calendar error");
      const link = data.hangoutLink || data.conferenceData?.entryPoints?.find((p: { entryPointType: string }) => p.entryPointType === "video")?.uri;
      if (link) return { link, eventId: data.id, source: "google" };
    } catch (err) {
      console.error("Google Meet creation failed:", err);
    }
  }
  const fixed = (await getSettings()).meetingLink;
  return fixed ? { link: fixed, source: "fixed" } : { link: "", source: "none" };
}

/** Keeps the Google event in sync when a meeting is edited. Silent on failure. */
export async function updateMeetingEvent(eventId: string, e: EventInput) {
  const token = await accessToken();
  if (!token) return;
  await fetch(`${CAL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody(e)),
  }).catch((err) => console.error("Google event update failed:", err));
}

export async function cancelMeetingEvent(eventId: string) {
  const token = await accessToken();
  if (!token) return;
  await fetch(`${CAL}/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch((err) =>
    console.error("Google event delete failed:", err)
  );
}
