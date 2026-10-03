import { cancelMeetingEvent, createMeeting, updateMeetingEvent } from "./google";
import { getSettings } from "./settings";
import { Client } from "@/models/Client";
import { User } from "@/models/User";

/** Client contact + every portal login of that client: they all get the calendar invite. */
async function attendees(clientId: string) {
  const [client, users] = await Promise.all([
    Client.findById(clientId).select("email").lean<{ email?: string }>(),
    User.find({ role: "client", client: clientId, status: { $ne: "disabled" } }).select("email").lean<{ email: string }[]>(),
  ]);
  return [client?.email || "", ...users.map((u) => u.email)].filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MeetingDoc = any;

async function eventInput(m: MeetingDoc) {
  const s = await getSettings();
  return {
    title: `${m.title} · ${s.companyName || "Zoxen Digital"}`,
    start: new Date(m.date),
    minutes: m.minutes || 30,
    description: m.notes || "",
    attendees: await attendees(String(m.client)),
  };
}

/**
 * Gives a scheduled meeting a joining link when it has none: a new Google Meet
 * (plus calendar invite) when Google is connected, otherwise the fixed link from Settings.
 * Saves the meeting. Returns where the link came from.
 */
export async function ensureMeetingLink(m: MeetingDoc) {
  if (m.link || m.status !== "Scheduled") return "existing";
  const r = await createMeeting(await eventInput(m));
  if (r.link) m.link = r.link;
  if (r.eventId) m.googleEventId = r.eventId;
  await m.save();
  return r.source;
}

/** Pushes title / time / duration changes to the Google event (and its invitees). */
export async function syncMeetingEvent(m: MeetingDoc) {
  if (m.googleEventId) await updateMeetingEvent(m.googleEventId, await eventInput(m));
}

/** Cancels the Google event so invitees see it removed from their calendars. */
export async function cancelMeeting(m: MeetingDoc) {
  if (m.googleEventId) {
    await cancelMeetingEvent(m.googleEventId);
    m.googleEventId = undefined;
  }
}
