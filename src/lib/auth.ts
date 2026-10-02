import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "zx_session";

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-secret-change-me-in-env-file");
}

export async function createSession(email: string) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(token?: string | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as { email: string };
  } catch {
    return null;
  }
}
