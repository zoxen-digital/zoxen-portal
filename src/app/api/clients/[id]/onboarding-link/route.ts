import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { dbConnect } from "@/lib/db";
import { appUrl } from "@/lib/mailer";
import { clientFormToken } from "@/lib/onboarding";
import { notifyClient } from "@/lib/client-notify";

type Ctx = { params: Promise<{ id: string }> };

/** The client's personal onboarding form link. Body { send: true } also sends it (portal + push + email). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Client not found", 404);
  await dbConnect();
  const path = `/onboarding/${await clientFormToken(id)}`;
  const link = appUrl(path);
  const { send } = await req.json().catch(() => ({}));
  let via: string | null = null;
  if (send) {
    via = await notifyClient(
      id,
      {
        title: "Please complete your onboarding form",
        body: "Share your business details, goals, pages and design preferences so we can start your project. It takes about 5 minutes.",
        link: path,
        button: "Open the form",
        email: true,
      },
      user
    );
  }
  return json({ link, via });
});
