/**
 * Admin sessions for the Worker, using WebCrypto only.
 *
 * Signing in: the browser sends a Firebase ID token, which is verified against
 * Google's public keys. The session itself is our own HMAC-signed cookie, so
 * checking it on later requests costs well under a millisecond of CPU.
 */
import { getProjectId, googleFetch } from "@/lib/firebase/google-auth";
import type { Env } from "./env";

export const ADMIN_COOKIE_NAME = "tth_admin_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 5;

const ID_TOKEN_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1";
const JWKS_FALLBACK_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 5 * 60;
const USER_CHECK_TTL_MS = 5 * 60 * 1000;
const RSA = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

export type AdminSession = { uid: string; email: string };
export type SessionPayload = AdminSession & { iat: number; exp: number };
export type IdTokenClaims = {
  uid: string;
  email?: string;
  /** Whether the identity provider has verified the email address. */
  emailVerified: boolean;
  /** How the user signed in, e.g. "google.com" or "password". */
  signInProvider?: string;
  /** Seconds since epoch when the user last signed in. */
  authTime: number;
};

// ---------- encoding ----------

function toBytes(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text);
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length));
  bytes.set(encoded);
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("Invalid base64url");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment))) as T;
}

// ---------- allow list ----------

export function isAllowedAdminEmail(email: string | null | undefined, adminEmails: string | undefined) {
  if (!email) return false;

  return (adminEmails || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

// ---------- Firebase ID token ----------

type Jwk = JsonWebKey & { kid?: string };

let jwks: { keys: Map<string, Jwk>; expiresAt: number } | null = null;
const importedKeys = new Map<string, CryptoKey>();

async function loadJwks() {
  const response = await fetch(ID_TOKEN_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Could not load ID token keys (${response.status})`);
  }

  const maxAge = /max-age=(\d+)/.exec(response.headers.get("cache-control") || "");
  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = new Map<string, Jwk>();
  for (const key of body.keys || []) {
    if (key.kid) keys.set(key.kid, key);
  }

  importedKeys.clear();
  jwks = {
    keys,
    expiresAt: Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : JWKS_FALLBACK_TTL_MS)
  };
  return jwks;
}

async function getVerificationKey(kid: string): Promise<CryptoKey> {
  const fresh = jwks !== null && jwks.expiresAt > Date.now();
  if (fresh) {
    const known = importedKeys.get(kid);
    if (known) return known;
  }

  let jwk = (fresh && jwks ? jwks : await loadJwks()).keys.get(kid);
  // Google rotates these keys; an unknown kid may just be newer than our copy.
  if (!jwk && fresh) jwk = (await loadJwks()).keys.get(kid);
  if (!jwk) throw new Error("ID token was signed by an unknown key");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    RSA,
    false,
    ["verify"]
  );
  importedKeys.set(kid, key);
  return key;
}

export async function verifyIdToken(idToken: string): Promise<IdTokenClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed ID token");

  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
  if (header.alg !== "RS256") throw new Error("Unexpected ID token algorithm");
  if (!header.kid) throw new Error("ID token has no key id");

  const key = await getVerificationKey(header.kid);
  const valid = await crypto.subtle.verify(
    RSA.name,
    key,
    base64UrlDecode(parts[2]),
    toBytes(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("ID token signature is invalid");

  const claims = decodeJson<{
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
    email?: string;
    email_verified?: boolean;
    firebase?: { sign_in_provider?: string };
  }>(parts[1]);
  const projectId = getProjectId();
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("ID token has the wrong issuer");
  }
  if (claims.aud !== projectId) throw new Error("ID token has the wrong audience");
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("ID token has expired");
  if (typeof claims.iat !== "number" || claims.iat > now + CLOCK_SKEW_SECONDS) {
    throw new Error("ID token was issued in the future");
  }
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("ID token has no subject");

  return {
    uid: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    emailVerified: claims.email_verified === true,
    signInProvider: claims.firebase?.sign_in_provider,
    authTime: typeof claims.auth_time === "number" ? claims.auth_time : claims.iat
  };
}

// ---------- revocation ----------

type UserState = { validSince: number; checkedAt: number };
const userChecks = new Map<string, UserState>();

/**
 * Rejects when the account is gone, disabled, or had its sessions revoked
 * after `issuedAt` (seconds). A healthy account is remembered for five
 * minutes so most requests need no Identity Toolkit call.
 */
export async function assertNotRevoked(uid: string, issuedAt: number, options: { fresh?: boolean } = {}) {
  let state = options.fresh ? undefined : userChecks.get(uid);

  if (!state || Date.now() - state.checkedAt > USER_CHECK_TTL_MS) {
    userChecks.delete(uid);
    const body = await googleFetch<{
      users?: Array<{ validSince?: string; disabled?: boolean }>;
    }>(`${IDENTITY_TOOLKIT}/projects/${getProjectId()}/accounts:lookup`, {
      body: { localId: [uid] }
    });

    const user = body.users?.[0];
    if (!user) throw new Error("User not found");
    if (user.disabled) throw new Error("User is disabled");

    state = { validSince: Number(user.validSince || 0), checkedAt: Date.now() };
    userChecks.set(uid, state);
  }

  if (state.validSince > issuedAt) throw new Error("Session has been revoked");
}

// ---------- session cookie ----------

let hmacKey: { secret: string; key: CryptoKey } | null = null;

async function getHmacKey(secret: string | undefined): Promise<CryptoKey> {
  if (!secret) throw new Error("Missing SESSION_SECRET");
  if (hmacKey?.secret === secret) return hmacKey.key;

  const key = await crypto.subtle.importKey(
    "raw",
    toBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  hmacKey = { secret, key };
  return key;
}

export async function signSessionToken(payload: SessionPayload, secret: string | undefined) {
  const body = base64UrlEncode(toBytes(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await getHmacKey(secret), toBytes(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function createSessionToken(session: AdminSession, env: Env) {
  const now = Math.floor(Date.now() / 1000);
  return signSessionToken(
    { uid: session.uid, email: session.email, iat: now, exp: now + SESSION_DURATION_SECONDS },
    env.SESSION_SECRET
  );
}

/** Returns the session, or null for anything that is not a valid, current admin session. */
export async function verifySessionToken(token: string, env: Env): Promise<AdminSession | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

    // crypto.subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getHmacKey(env.SESSION_SECRET),
      base64UrlDecode(parts[1]),
      toBytes(parts[0])
    );
    if (!valid) return null;

    const payload = decodeJson<Partial<SessionPayload>>(parts[0]);
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.uid !== "string" || !payload.uid) return null;
    if (typeof payload.email !== "string") return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp <= now) return null;
    if (!isAllowedAdminEmail(payload.email, env.ADMIN_EMAILS)) return null;

    await assertNotRevoked(payload.uid, payload.iat);
    return { uid: payload.uid, email: payload.email };
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export async function getAdminSession(request: Request, env: Env): Promise<AdminSession | null> {
  const token = readCookie(request, ADMIN_COOKIE_NAME);
  return token ? verifySessionToken(token, env) : null;
}

function cookieAttributes(request: Request, maxAge: number) {
  // Browsers drop Secure cookies on plain http, which is what local dev uses.
  const secure = new URL(request.url).protocol === "http:" ? "" : " Secure;";
  return `HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function sessionCookie(request: Request, token: string) {
  return `${ADMIN_COOKIE_NAME}=${token}; ${cookieAttributes(request, SESSION_DURATION_SECONDS)}`;
}

export function clearedSessionCookie(request: Request) {
  return `${ADMIN_COOKIE_NAME}=; ${cookieAttributes(request, 0)}`;
}

/** Test hook: forget cached keys and account checks. */
export function resetSessionCaches() {
  jwks = null;
  importedKeys.clear();
  userChecks.clear();
  hmacKey = null;
}
