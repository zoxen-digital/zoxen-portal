import { dbConnect } from "@/lib/db";
import { Meeting } from "@/models/Meeting";
import { error, handle, json, pick, validId } from "@/lib/api";
import { MEETING_FIELDS } from "@/lib/fields";
import { ADMIN, apiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  const data = pick(await req.json(), MEETING_FIELDS.filter((f) => f !== "client"));
  if ("title" in data && !data.title) return error("Meeting title is required");
  if ("date" in data) {
    const d = new Date(String(data.date || ""));
    if (isNaN(d.getTime())) return error("Choose a date and time");
    data.date = d;
  }
  if ("project" in data && !validId(String(data.project))) data.project = null;
  const meeting = await Meeting.findByIdAndUpdate(id, data, { new: true }).lean();
  return meeting ? json(meeting) : error("Meeting not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Invalid id", 404);
  await dbConnect();
  await Meeting.findByIdAndDelete(id);
  return json({ ok: true });
});
