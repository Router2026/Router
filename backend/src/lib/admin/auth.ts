import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "admin_token";

// Constant-time string comparison to prevent timing attacks.
// SHA-256 hex strings are always 64 chars, so length check is just a guard.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// SHA-256 hash of secret — not trivially reversible unlike base64.
// Uses Web Crypto API (available in both Edge and Node.js 18+ runtimes).
async function makeToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret + ":router-admin");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAdminCookie(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token != null && safeEqual(token, await makeToken(secret));
}

export async function verifyAdminRequest(req: NextRequest): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token != null && safeEqual(token, await makeToken(secret));
}

export async function makeAdminCookieHeader(secret: string): Promise<string> {
  const token = await makeToken(secret);
  const maxAge = 60 * 60 * 8; // 8 hours
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearAdminCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

// Wrapper function to enforce admin authentication based on the request.
export async function requireAdmin(req: NextRequest): Promise<{ ok: boolean }> {
  // Check if the request contains a valid admin cookie.
  const isValid = await verifyAdminRequest(req);

  // Return the result in the expected object format.
  return { ok: isValid };
}
