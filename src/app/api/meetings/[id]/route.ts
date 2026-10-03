import { dbConnect } from "@/lib/db";
import { Meeting } from "@/models/Meeting";
import { error, handle, json, pick, validId } from "@/lib/api";
import { MEETING_FIELDS } from "@/lib/fields";
import { ADMIN, apiUser } from "@/lib/session";
import { notifyClient } from "@/lib/client-notify";
import { cancelMeeting, ensureMeetingLink, syncMeetingEvent } from "@/lib/meetings";

type Ctx = { params: Promise<{ id: string }> };

/** Edit a meeting. Changing status of a client request (Requested -> Scheduled / Declined) notifies the client. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const meeting = await Meeting.findById(id);
  if (!meeting) return error("Meeting not found", 404);

  const data = pick(await req.json(), [...MEETING_FIELDS.filter((f) => f !== "client"), "status"]);
  if ("title" in data && !data.title) return error("Meeting title is required");
  if ("date" in data) {
    const d = new Date(String(data.date || ""));
    if (isNaN(d.getTime())) return error("Choose a date and time");
    data.date = d;
  }
  if ("minutes" in data) data.minutes = Math.min(480, Math.max(10, Number(data.minutes) || 30));
  if ("project" in data && !validId(String(data.project))) data.project = null;
  if ("status" in data && !["Scheduled", "Requested", "Declined"].includes(String(data.status))) return error("Invalid status");

  const before = meeting.status;
  const timeChanged = ("date" in data && +new Date(data.date as Date) !== +meeting.date) || ("minutes" in data && data.minutes !== meeting.minutes) || ("title" in data && data.title !== meeting.title);
  meeting.set(data);
  await meeting.save();

  let linkSource = "existing";
  if (meeting.status === "Scheduled") {
    linkSource = await ensureMeetingLink(meeting);
    if (timeChanged && linkSource === "existing") await syncMeetingEvent(meeting);
  } else if (meeting.status === "Declined") {
    await cancelMeeting(meeting);
    await meeting.save();
  }

  if (before === "Requested" && meeting.status === "Scheduled") {
    await notifyClient(
      String(meeting.client),
      {
        title: `Meeting confirmed: ${meeting.title}`,
        body: `Your meeting is confirmed. See the date, time${meeting.link ? " and joining link" : ""} in your portal.`,
        link: "/portal",
        button: "View meeting",
        email: true,
      },
      user
    );
  } else if (before === "Requested" && meeting.status === "Declined") {
    await notifyClient(
      String(meeting.client),
      {
        title: `Meeting request update: ${meeting.title}`,
        body: "We could not make the requested time. Our team will reach out with another time, or you can request a new slot from your portal.",
        link: "/portal",
        button: "Open portal",
        email: true,
      },
      user
    );
  }
  return json({ meeting, linkSource });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const meeting = await Meeting.findById(id);
  if (meeting) {
    await cancelMeeting(meeting);
    await meeting.deleteOne();
  }
  return json({ ok: true });
});
