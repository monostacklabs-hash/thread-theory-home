/**
 * Service-account access for Google APIs using only fetch + WebCrypto, so it
 * runs on Cloudflare Workers where firebase-admin cannot. Signing the token
 * request costs more CPU than a free-plan Worker request allows, so the
 * access token is cached in module scope and, when available, in KV.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/firebase.messaging",
  "https://www.googleapis.com/auth/identitytoolkit"
].join(" ");
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export function getServiceAccount(): ServiceAccount {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId) throw new Error("Missing FIREBASE_PROJECT_ID");
  if (!clientEmail) throw new Error("Missing FIREBASE_CLIENT_EMAIL");
  if (!privateKey) throw new Error("Missing FIREBASE_PRIVATE_KEY");

  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

export function getProjectId(): string {
  return getServiceAccount().projectId;
}

/** The subset of a Workers KV namespace used to share the access token between isolates. */
export type TokenCacheStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

type CachedToken = { token: string; expiresAt: number };

const KV_KEY = "google-access-token";
const KV_MIN_TTL_SECONDS = 60;

let cached: CachedToken | null = null;
let pending: Promise<string> | null = null;
let tokenCache: TokenCacheStore | null = null;

/** Point the module at a KV namespace (or null/undefined for none). Call once per request. */
export function setTokenCache(store: TokenCacheStore | null | undefined) {
  tokenCache = store || null;
}

function isFresh(entry: CachedToken | null): entry is CachedToken {
  return Boolean(entry && entry.expiresAt - REFRESH_MARGIN_MS > Date.now());
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlFromText(text: string): string {
  return base64UrlFromBytes(new TextEncoder().encode(text));
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signAssertion(account: ServiceAccount): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlFromText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlFromText(
    JSON.stringify({
      scope: SCOPES,
      iss: account.clientEmail,
      sub: account.clientEmail,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600
    })
  );
  const signingInput = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

async function readTokenCache(): Promise<CachedToken | null> {
  if (!tokenCache) return null;
  try {
    const raw = await tokenCache.get(KV_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<CachedToken>;
    if (typeof entry.token !== "string" || typeof entry.expiresAt !== "number") return null;
    return { token: entry.token, expiresAt: entry.expiresAt };
  } catch {
    return null;
  }
}

async function writeTokenCache(entry: CachedToken) {
  if (!tokenCache) return;
  try {
    const ttl = Math.floor((entry.expiresAt - Date.now() - REFRESH_MARGIN_MS) / 1000);
    await tokenCache.put(KV_KEY, JSON.stringify(entry), {
      expirationTtl: Math.max(KV_MIN_TTL_SECONDS, ttl)
    });
  } catch {
    // The cache is an optimisation; the token we just minted is still good.
  }
}

async function mintAccessToken(): Promise<string> {
  const assertion = await signAssertion(getServiceAccount());

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  const entry = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  cached = entry;
  await writeTokenCache(entry);
  return entry.token;
}

/** Module scope first, then KV, and only then the expensive RSA signing. */
async function loadAccessToken(): Promise<string> {
  const shared = await readTokenCache();
  if (isFresh(shared)) {
    cached = shared;
    return shared.token;
  }

  return mintAccessToken();
}

export async function getAccessToken(): Promise<string> {
  if (isFresh(cached)) {
    return cached.token;
  }

  if (!pending) {
    pending = loadAccessToken().finally(() => {
      pending = null;
    });
  }

  return pending;
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly status: string | undefined,
    readonly body: unknown
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

/** Authenticated JSON call to a Google API. Throws GoogleApiError on non-2xx. */
export async function googleFetch<T = unknown>(
  url: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    method: init.method || (init.body === undefined ? "GET" : "POST"),
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { "content-type": "application/json" })
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

  const text = await response.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    // runQuery-style endpoints wrap errors in an array.
    const container = Array.isArray(parsed) ? parsed[0] : parsed;
    const error = (container as { error?: { message?: string; status?: string } } | undefined)?.error;
    throw new GoogleApiError(
      error?.message || `Google API request failed (${response.status})`,
      response.status,
      error?.status,
      parsed
    );
  }

  return parsed as T;
}

/** Test hook: forget the cached access token. */
export function resetAccessTokenCache() {
  cached = null;
  pending = null;
}
