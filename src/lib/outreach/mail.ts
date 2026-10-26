import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { resolveTxt } from "dns/promises";
import { randomUUID } from "crypto";
import { decrypt } from "./secure";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Box = {
  _id: unknown;
  email: string;
  fromName?: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  username?: string;
  passwordEnc: string;
};

const auth = (b: Box) => ({ user: b.username || b.email, pass: decrypt(b.passwordEnc).replace(/\s+/g, "") });

function transport(b: Box) {
  return nodemailer.createTransport({
    host: b.smtpHost,
    port: b.smtpPort,
    secure: b.smtpPort === 465,
    auth: auth(b),
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
}

/** Sends one plain-text email (plain text reads as personal and lands better than HTML). Returns the Message-ID. */
export async function sendOne(
  b: Box,
  m: { to: string; subject: string; text: string; unsubscribeUrl: string; inReplyTo?: string; references?: string[] }
) {
  const domain = b.email.split("@")[1];
  const messageId = `<${randomUUID()}@${domain}>`;
  await transport(b).sendMail({
    from: { name: b.fromName || "", address: b.email },
    to: m.to,
    subject: m.subject,
    text: m.text,
    messageId,
    ...(m.inReplyTo ? { inReplyTo: m.inReplyTo, references: m.references || [m.inReplyTo] } : {}),
    headers: {
      // One-click unsubscribe (RFC 8058), required by Gmail/Yahoo for bulk senders.
      "List-Unsubscribe": `<${m.unsubscribeUrl}>, <mailto:${b.email}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  return messageId;
}

/** Checks SMTP and IMAP logins (used by "Test mailbox"). */
export async function testMailbox(b: Box) {
  await transport(b).verify();
  const c = new ImapFlow({ host: b.imapHost, port: b.imapPort, secure: b.imapPort === 993, auth: auth(b), logger: false });
  await c.connect();
  await c.logout();
  return true;
}

export type Incoming = { uid: number; from: string; subject: string; text: string; inReplyTo: string; references: string[]; date: Date; isBounce: boolean; bouncedTo: string[] };

const BOUNCE_FROM = /mailer-daemon|postmaster|mail delivery (sub)?system/i;
const BOUNCE_SUBJECT = /undeliver|delivery status notification|delivery (has )?failed|returned mail|failure notice|mail delivery failed|could not be delivered/i;

/** New messages in INBOX since the last UID we saw (stays within a time budget). */
export async function fetchNew(b: Box, lastUid: number, uidValidity: string, budgetMs = 20000) {
  const started = Date.now();
  const c = new ImapFlow({ host: b.imapHost, port: b.imapPort, secure: b.imapPort === 993, auth: auth(b), logger: false, socketTimeout: 30000 });
  await c.connect();
  const out: Incoming[] = [];
  let maxUid = lastUid;
  let validity = uidValidity;
  const lock = await c.getMailboxLock("INBOX");
  try {
    const mb = c.mailbox as any;
    validity = String(mb?.uidValidity || "");
    // Mailbox was rebuilt: start from now instead of re-reading everything.
    let from = validity !== uidValidity ? Math.max(1, Number(mb?.uidNext || 1) - 50) : lastUid + 1;
    if (from < 1) from = 1;
    for await (const msg of c.fetch(`${from}:*`, { uid: true, source: true }, { uid: true })) {
      if (msg.uid <= lastUid && validity === uidValidity) continue;
      maxUid = Math.max(maxUid, msg.uid);
      const p = await simpleParser(msg.source as Buffer);
      const fromAddr = (p.from?.value?.[0]?.address || "").toLowerCase();
      const subject = p.subject || "";
      const text = (p.text || "").slice(0, 20000);
      const isBounce = BOUNCE_FROM.test(fromAddr + " " + (p.from?.text || "")) || BOUNCE_SUBJECT.test(subject);
      const refs = Array.isArray(p.references) ? p.references : p.references ? [p.references] : [];
      out.push({
        uid: msg.uid,
        from: fromAddr,
        subject,
        text,
        inReplyTo: p.inReplyTo || "",
        references: refs,
        date: p.date || new Date(),
        isBounce,
        bouncedTo: isBounce ? [...new Set((text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi) || []).map((e) => e.toLowerCase()))] : [],
      });
      if (Date.now() - started > budgetMs) break;
    }
  } finally {
    lock.release();
    await c.logout().catch(() => {});
  }
  return { messages: out, maxUid, uidValidity: validity };
}

/** Does the sending domain have SPF, DKIM and DMARC records? */
export async function checkDomain(email: string) {
  const domain = email.split("@")[1]!.toLowerCase();
  const txt = async (name: string) => {
    try {
      return (await resolveTxt(name)).map((r) => r.join(""));
    } catch {
      return [] as string[];
    }
  };
  const spf = (await txt(domain)).find((r) => /^v=spf1/i.test(r)) || "";
  const dmarc = (await txt(`_dmarc.${domain}`)).find((r) => /^v=DMARC1/i.test(r)) || "";
  let dkim = "";
  for (const sel of ["google", "default", "selector1", "selector2", "zoho", "zmail", "k1", "s1", "s2", "mail", "dkim", "titan1"]) {
    const r = (await txt(`${sel}._domainkey.${domain}`)).find((x) => /v=DKIM1|k=rsa|p=/i.test(x));
    if (r) {
      dkim = sel;
      break;
    }
  }
  const freeMail = /^(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|aol)\./.test(domain);
  return { domain, spf: !!spf, dkim: !!dkim, dkimSelector: dkim, dmarc: !!dmarc, freeMail };
}

/** Common providers so the form only needs email + app password. */
export const PRESETS: Record<string, { smtpHost: string; smtpPort: number; imapHost: string; imapPort: number }> = {
  google: { smtpHost: "smtp.gmail.com", smtpPort: 465, imapHost: "imap.gmail.com", imapPort: 993 },
  zoho: { smtpHost: "smtp.zoho.com", smtpPort: 465, imapHost: "imap.zoho.com", imapPort: 993 },
  outlook: { smtpHost: "smtp.office365.com", smtpPort: 587, imapHost: "outlook.office365.com", imapPort: 993 },
};
