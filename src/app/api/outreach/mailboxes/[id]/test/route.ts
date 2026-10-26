import { dbConnect } from "@/lib/db";
import { error, handle, json, validId } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { checkDomain, testMailbox, type Box } from "@/lib/outreach/mail";
import { OutreachMailbox } from "@/models/Outreach";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Logs in to SMTP and IMAP and checks SPF / DKIM / DMARC for the sending domain. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  await apiUser(ADMIN);
  const { id } = await params;
  if (!validId(id)) return error("Mailbox not found", 404);
  await dbConnect();
  const box = await OutreachMailbox.findById(id).select("+passwordEnc").lean<Box>();
  if (!box) return error("Mailbox not found", 404);
  let login = "ok";
  try {
    await testMailbox(box);
    await OutreachMailbox.updateOne({ _id: id }, { $set: { lastError: "" } });
  } catch (e) {
    login = (e as Error).message;
    await OutreachMailbox.updateOne({ _id: id }, { $set: { lastError: `Test: ${login}`.slice(0, 300) } });
  }
  const dns = await checkDomain(box.email);
  return json({ login, dns });
});
