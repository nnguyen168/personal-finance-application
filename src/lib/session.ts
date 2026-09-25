import { jwtVerify, SignJWT } from "jose";

/**
 * Optional household password. When APP_PASSWORD is unset the app is open,
 * which is fine on a laptop; set it before exposing the app on the internet.
 */
export const SESSION_COOKIE = "hearth_session";
const SESSION_DAYS = 90;

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET || `hearth:${process.env.APP_PASSWORD ?? ""}`;
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<{ token: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 86400;
  const token = await new SignJWT({ household: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  return { token, maxAge };
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!token) return false;
  try {
    await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
