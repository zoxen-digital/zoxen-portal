import { dbConnect } from "@/lib/db";
import { error, handle, json } from "@/lib/api";
import { ADMIN, apiUser } from "@/lib/session";
import { encrypt } from "@/lib/outreach/secure";
import { OutreachMailbox } from "@/models/Outreach";
import { PRESETS } from "@/lib/outreach/mail";

export const GET = handle(async () => {
  await apiUser(ADMIN);
  await dbConnect();
  return json(await OutreachMailbox.find().sort({ createdAt: 1 }).lean());
});

export const POST = handle(async (req: Request) => {
  await apiUser(ADMIN);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Enter the mailbox email address");
  if (!b.password) return error("Enter the mailbox password or app password");
  const preset = PRESETS[String(b.provider || "")];
  const smtpHost = preset?.smtpHost || String(b.smtpHost || "").trim();
  const imapHost = preset?.imapHost || String(b.imapHost || "").trim();
  if (!smtpHost || !imapHost) return error("Choose a provider or enter SMTP and IMAP servers");
  await dbConnect();
  if (await OutreachMailbox.exists({ email })) return error("This mailbox is already connected");
  const box = await OutreachMailbox.create({
    email,
    fromName: String(b.fromName || "").trim().slice(0, 60),
    smtpHost,
    smtpPort: preset?.smtpPort || Number(b.smtpPort) || 465,
    imapHost,
    imapPort: preset?.imapPort || Number(b.imapPort) || 993,
    username: String(b.username || email).trim(),
    passwordEnc: encrypt(String(b.password)),
    dailyCap: Math.min(100, Math.max(5, Number(b.dailyCap) || 40)),
    warmupStart: Math.min(50, Math.max(3, Number(b.warmupStart) || 10)),
    warmupStep: Math.min(20, Math.max(1, Number(b.warmupStep) || 5)),
    startedAt: new Date(),
  });
  const { passwordEnc: _p, ...safe } = box.toObject();
  return json(safe, 201);
});
