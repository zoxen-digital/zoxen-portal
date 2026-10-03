import { dbConnect } from "@/lib/db";
import { Meeting } from "@/models/Meeting";
import { Client } from "@/models/Client";
import { error, handle, json, pick, validId } from "@/lib/api";
import { MEETING_FIELDS } from "@/lib/fields";
import { ADMIN, apiUser } from "@/lib/session";
import { clientUserIds, notify } from "@/lib/notify";
import { ensureMeetingLink } from "@/lib/meetings";

export const POST = handle(async (req: Request) => {
  const user = await apiUser(ADMIN);
  await dbConnect();
  const data = pick(await req.json(), MEETING_FIELDS);
  if (!data.title) return error("Meeting title is required");
  if (!data.client || !validId(String(data.client)) || !(await Client.exists({ _id: data.client }))) return error("Client not found");
  const date = new Date(String(data.date || ""));
  if (isNaN(date.getTime())) return error("Choose a date and time");
  data.date = date;
  data.minutes = Math.min(480, Math.max(10, Number(data.minutes) || 30));
  if (!data.project || !validId(String(data.project))) delete data.project;
  const meeting = await Meeting.create({ ...data, createdBy: user.name, status: "Scheduled" });
  // Empty link = create a Google Meet (or use the fixed link from Settings).
  // Meetings starting now (or up to 2 hours ago) still need a link.
  const linkSource = date.getTime() > Date.now() - 2 * 60 * 60 * 1000 ? await ensureMeetingLink(meeting) : "existing";

  if (date.getTime() > Date.now() - 2 * 60 * 60 * 1000) {
    await notify(await clientUserIds(String(data.client)), {
      title: `Meeting scheduled: ${meeting.title}`,
      // The server's time zone is not the client's, so the exact time is shown in the portal instead.
      body: `A meeting has been scheduled with you. See the date, time${meeting.link ? " and joining link" : ""} in your portal.`,
      link: "/portal",
      email: { button: "View in portal" },
    });
  }
  return json({ meeting, linkSource }, 201);
});
