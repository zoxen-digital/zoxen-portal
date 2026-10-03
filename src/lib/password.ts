import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;

/** Stored as "scrypt$<salt>$<hash>". */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function checkPassword(password: string, stored?: string | null) {
  if (!stored) return false;
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

/** Random invite / reset token. Only its sha256 is stored in the database. */
export function newToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordProblem(pw: unknown) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters";
  return null;
}
