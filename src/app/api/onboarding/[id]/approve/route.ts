import { dbConnect } from "@/lib/db";
import { Onboarding } from "@/models/Onboarding";
import { error, handle, json, validId } from "@/lib/api";
import { STAFF, apiUser } from "@/lib/session";
import { approveSubmission } from "@/lib/onboarding";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { client: "<clientId>" | "new" }. Tags the form to the client and starts the project. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(STAFF);
  const { id } = await params;
  if (!validId(id)) return error("Submission not found", 404);
  const { client, newClient } = await req.json().catch(() => ({}));
  if (typeof client !== "string" || !client) return error("Choose the client this form belongs to");
  await dbConnect();
  // Claim it first so two people approving at once cannot create two projects.
  const sub = await Onboarding.findOneAndUpdate(
    { _id: id, status: { $nin: ["Approved", "Converted", "Approving"] }, project: null },
    { $set: { status: "Approving" } },
    { new: true }
  );
  if (!sub) return error("This submission is already approved (or being approved right now)");
  try {
    return json(await approveSubmission(sub, client, user, newClient && typeof newClient === "object" ? newClient : {}));
  } catch (e) {
    // Give it back if approval failed (e.g. wrong client), so it can be approved again.
    await Onboarding.updateOne({ _id: id, project: null, status: "Approving" }, { $set: { status: "Reviewed" } });
    throw e;
  }
});
