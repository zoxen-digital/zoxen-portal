import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

/** Mailbox passwords are stored encrypted (AES-256-GCM, key derived from AUTH_SECRET) and only decrypted on the server to send/read mail. */

const secret = () => process.env.AUTH_SECRET || "dev-only-secret-change-me-in-env-file";
const key = () => createHash("sha256").update("outreach-mailbox:" + secret()).digest();

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(enc!), d.final()]).toString("utf8");
}

/** Signed, non-guessable unsubscribe token for an email address. */
export function unsubToken(email: string) {
  const e = email.toLowerCase();
  const sig = createHmac("sha256", secret()).update("unsub:" + e).digest("base64url").slice(0, 22);
  return Buffer.from(e).toString("base64url") + "." + sig;
}

export function readUnsubToken(token: string) {
  const [e64, sig] = String(token || "").split(".");
  if (!e64 || !sig) return null;
  const email = Buffer.from(e64, "base64url").toString("utf8");
  const expected = unsubToken(email).split(".")[1]!;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? email : null;
}
