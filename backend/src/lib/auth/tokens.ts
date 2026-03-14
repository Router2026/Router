// JWT + password hashing using built-in Web Crypto API (no extra packages)

function getSecret(): string {
  return process.env.JWT_SECRET || "router-jwt-dev-secret-change-in-prod";
}

// ── Base64url helpers ─────────────────────────────────────────────────────

function b64url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64url");
}

function fromB64url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

// ── JWT (HS256) ───────────────────────────────────────────────────────────

export async function signJWT(payload: Record<string, unknown>): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 })
  ).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`)));
  return `${header}.${body}.${sig}`;
}

export async function verifyJWT(token: string): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [header, body, sig] = parts;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC", key, fromB64url(sig), new TextEncoder().encode(`${header}.${body}`)
  );
  if (!valid) throw new Error("Invalid token signature");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return payload;
}

// ── Password hashing (PBKDF2-SHA256, 100k iterations) ────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Buffer.from(salt).toString("hex");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256
  );
  const hashHex = Buffer.from(bits).toString("hex");
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(Buffer.from(saltHex, "hex"));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256
  );
  const newHash = Buffer.from(bits).toString("hex");
  // Constant-time comparison
  let diff = 0;
  const a = hashHex, b = newHash;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0 && a.length === b.length;
}

// ── Extract user from Bearer token ───────────────────────────────────────

export async function getUserFromRequest(req: Request): Promise<{ id: number; email: string; is_admin: boolean } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = await verifyJWT(auth.slice(7));
    return { id: payload.id as number, email: payload.email as string, is_admin: payload.is_admin as boolean };
  } catch {
    return null;
  }
}
