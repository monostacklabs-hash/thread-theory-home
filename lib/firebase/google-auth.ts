/**
 * Service-account access for Google APIs using only fetch + WebCrypto (via
 * jose), so it runs on Cloudflare Workers where firebase-admin cannot.
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

let cached: { token: string; expiresAt: number } | null = null;
let pending: Promise<string> | null = null;

async function mintAccessToken(): Promise<string> {
  // Loaded lazily: jose is ESM-only and is only needed when a token is minted.
  const { importPKCS8, SignJWT } = await import("jose");
  const account = getServiceAccount();
  const key = await importPKCS8(account.privateKey, "RS256");
  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({ scope: SCOPES })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.clientEmail)
    .setSubject(account.clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

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
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return cached.token;
  }

  if (!pending) {
    pending = mintAccessToken().finally(() => {
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
