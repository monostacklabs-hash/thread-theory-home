/**
 * Firebase Auth server operations over REST + jose, shaped like the subset of
 * firebase-admin/auth this app uses, so it runs on Cloudflare Workers.
 */
import type { JWTPayload, JWTVerifyGetKey } from "jose";
import { getProjectId, googleFetch } from "@/lib/firebase/google-auth";

const ID_TOKEN_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const SESSION_COOKIE_CERTS_URL =
  "https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys";
const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1";
const CERT_FALLBACK_TTL_MS = 60 * 60 * 1000;

export type DecodedToken = JWTPayload & {
  uid: string;
  email?: string;
  email_verified?: boolean;
  auth_time: number;
};

let idTokenKeys: JWTVerifyGetKey | null = null;
let sessionCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getSessionCert(kid: string): Promise<string> {
  if (!sessionCerts || sessionCerts.expiresAt < Date.now() || !sessionCerts.certs[kid]) {
    const response = await fetch(SESSION_COOKIE_CERTS_URL);
    if (!response.ok) {
      throw new Error(`Could not load session cookie certificates (${response.status})`);
    }
    const maxAge = /max-age=(\d+)/.exec(response.headers.get("cache-control") || "");
    sessionCerts = {
      certs: (await response.json()) as Record<string, string>,
      expiresAt: Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : CERT_FALLBACK_TTL_MS)
    };
  }

  const cert = sessionCerts.certs[kid];
  if (!cert) throw new Error("Session cookie was signed by an unknown key");
  return cert;
}

function toDecoded(payload: JWTPayload): DecodedToken {
  if (!payload.sub) throw new Error("Token has no subject");
  if (typeof payload.auth_time !== "number") throw new Error("Token has no auth_time");
  return { ...payload, uid: payload.sub } as DecodedToken;
}

async function assertNotRevoked(decoded: DecodedToken) {
  const body = await googleFetch<{
    users?: Array<{ validSince?: string; disabled?: boolean }>;
  }>(`${IDENTITY_TOOLKIT}/projects/${getProjectId()}/accounts:lookup`, {
    body: { localId: [decoded.uid] }
  });

  const user = body.users?.[0];
  if (!user) throw new Error("User not found");
  if (user.disabled) throw new Error("User is disabled");
  if (user.validSince && decoded.auth_time < Number(user.validSince)) {
    throw new Error("Session has been revoked");
  }
}

export class FirebaseServerAuth {
  async verifyIdToken(idToken: string): Promise<DecodedToken> {
    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    const projectId = getProjectId();
    idTokenKeys ||= createRemoteJWKSet(new URL(ID_TOKEN_JWKS_URL));

    const { payload } = await jwtVerify(idToken, idTokenKeys, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId
    });

    return toDecoded(payload);
  }

  async createSessionCookie(idToken: string, options: { expiresIn: number }): Promise<string> {
    const body = await googleFetch<{ sessionCookie: string }>(
      `${IDENTITY_TOOLKIT}/projects/${getProjectId()}:createSessionCookie`,
      { body: { idToken, validDuration: String(Math.floor(options.expiresIn / 1000)) } }
    );

    return body.sessionCookie;
  }

  async verifySessionCookie(sessionCookie: string, checkRevoked = false): Promise<DecodedToken> {
    const { decodeProtectedHeader, importX509, jwtVerify } = await import("jose");
    const projectId = getProjectId();
    const { kid } = decodeProtectedHeader(sessionCookie);
    if (!kid) throw new Error("Session cookie has no key id");

    const key = await importX509(await getSessionCert(kid), "RS256");
    const { payload } = await jwtVerify(sessionCookie, key, {
      algorithms: ["RS256"],
      issuer: `https://session.firebase.google.com/${projectId}`,
      audience: projectId
    });

    const decoded = toDecoded(payload);
    if (checkRevoked) await assertNotRevoked(decoded);
    return decoded;
  }
}
