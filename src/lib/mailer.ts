import nodemailer, { type Transporter } from "nodemailer";
import { getSettings } from "./settings";

const g = globalThis as unknown as { _zxMailer?: Transporter };

export function mailEnabled() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  if (!g._zxMailer) {
    const port = Number(process.env.SMTP_PORT || 465);
    g._zxMailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      // Gmail: SMTP_USER is the Gmail address, SMTP_PASS is a 16-character App Password.
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS?.replace(/\s+/g, "") },
    });
  }
  return g._zxMailer;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function appUrl(path = "") {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "") + path;
}

type Mail = {
  to: string;
  subject: string;
  heading: string;
  /** Plain paragraphs. They are escaped, so no HTML here. */
  lines: string[];
  button?: { label: string; url: string };
};

/** Branded email. Returns false (and logs) instead of throwing, so a mail problem never breaks the action. */
export async function sendMail(m: Mail) {
  if (!mailEnabled()) return false;
  try {
    const s = await getSettings();
    const company = s.companyName || "Zoxen Digital";
    const button = m.button
      ? `<tr><td style="padding:8px 32px 28px"><a href="${esc(m.button.url)}" style="display:inline-block;background:#2639e8;background-image:linear-gradient(90deg,#2639e8,#6c3bf5);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">${esc(m.button.label)}</a></td></tr>`
      : "";
    const html = `<!doctype html><html><body style="margin:0;background:#f6f7fc;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a1d2e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fc;padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e6e8f0;border-radius:16px;overflow:hidden">
<tr><td style="background:#0b1020;background-image:linear-gradient(90deg,#2639e8,#6c3bf5);padding:22px 32px;color:#fff;font-size:18px;font-weight:700">${esc(company)}</td></tr>
<tr><td style="padding:28px 32px 8px;font-size:20px;font-weight:700;color:#0b1020">${esc(m.heading)}</td></tr>
${m.lines.map((l) => `<tr><td style="padding:6px 32px;font-size:14px;line-height:1.6;color:#3a3f55">${esc(l)}</td></tr>`).join("")}
${button || '<tr><td style="padding:12px"></td></tr>'}
<tr><td style="padding:18px 32px;border-top:1px solid #e6e8f0;font-size:12px;color:#6b7085">${esc(company)}${s.tagline ? " · " + esc(s.tagline) : ""}${s.email ? `<br>${esc(s.email)}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
    const text = [m.heading, "", ...m.lines, m.button ? `\n${m.button.label}: ${m.button.url}` : "", "", company].join("\n");

    await transporter().sendMail({
      from: `"${(process.env.MAIL_FROM_NAME || company).replace(/"/g, "")}" <${process.env.SMTP_USER}>`,
      to: m.to,
      subject: m.subject,
      html,
      text,
    });
    return true;
  } catch (e) {
    console.error("Email failed:", e);
    return false;
  }
}
