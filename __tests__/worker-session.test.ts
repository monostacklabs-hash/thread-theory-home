/** @jest-environment node */

jest.mock("@/lib/firebase/google-auth", () => ({
  getProjectId: () => "demo-project",
  googleFetch: jest.fn()
}));

import { googleFetch } from "@/lib/firebase/google-auth";
import type { Env } from "@/worker/env";
import {
  ADMIN_COOKIE_NAME,
  clearedSessionCookie,
  createSessionToken,
  getAdminSession,
  isAllowedAdminEmail,
  resetSessionCaches,
  sessionCookie,
  signSessionToken,
  verifyIdToken,
  verifySessionToken
} from "@/worker/session";

const mockGoogleFetch = googleFetch as jest.MockedFunction<typeof googleFetch>;

const env: Env = {
  ASSETS: { fetch: jest.fn() },
  ADMIN_EMAILS: "Owner@Example.com, second@example.com",
  SESSION_SECRET: "test-secret-please-ignore"
};

const b64url = (value: string | ArrayBuffer) =>
  Buffer.from(value as string).toString("base64url");
const nowSeconds = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  resetSessionCaches();
  mockGoogleFetch.mockReset();
  mockGoogleFetch.mockResolvedValue({ users: [{ validSince: "1000" }] });
});

describe("isAllowedAdminEmail", () => {
  it("is case-insensitive and ignores spaces", () => {
    expect(isAllowedAdminEmail("owner@example.com", env.ADMIN_EMAILS)).toBe(true);
    expect(isAllowedAdminEmail("SECOND@example.com", env.ADMIN_EMAILS)).toBe(true);
    expect(isAllowedAdminEmail("other@example.com", env.ADMIN_EMAILS)).toBe(false);
    expect(isAllowedAdminEmail(undefined, env.ADMIN_EMAILS)).toBe(false);
    expect(isAllowedAdminEmail("owner@example.com", undefined)).toBe(false);
  });
});

describe("session cookie", () => {
  it("round-trips a session", async () => {
    const token = await createSessionToken({ uid: "u1", email: "owner@example.com" }, env);
    expect(await verifySessionToken(token, env)).toEqual({ uid: "u1", email: "owner@example.com" });

    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    expect(payload.exp - payload.iat).toBe(60 * 60 * 24 * 5);
  });

  it("reads the session from the request cookie", async () => {
    const token = await createSessionToken({ uid: "u1", email: "owner@example.com" }, env);
    const request = new Request("https://t/api/admin/me", {
      headers: { cookie: `other=1; ${ADMIN_COOKIE_NAME}=${token}; theme=dark` }
    });

    expect(await getAdminSession(request, env)).toEqual({ uid: "u1", email: "owner@example.com" });
    expect(await getAdminSession(new Request("https://t/"), env)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await createSessionToken({ uid: "u1", email: "second@example.com" }, env);
    const [, signature] = token.split(".");
    const forged = b64url(
      JSON.stringify({ uid: "u1", email: "owner@example.com", iat: nowSeconds(), exp: nowSeconds() + 999 })
    );

    expect(await verifySessionToken(`${forged}.${signature}`, env)).toBeNull();
  });

  it("rejects a tampered or missing signature and garbage", async () => {
    const token = await createSessionToken({ uid: "u1", email: "owner@example.com" }, env);
    const [body, signature] = token.split(".");
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

    expect(await verifySessionToken(`${body}.${flipped}`, env)).toBeNull();
    expect(await verifySessionToken(`${body}.`, env)).toBeNull();
    expect(await verifySessionToken(body, env)).toBeNull();
    expect(await verifySessionToken("not a token", env)).toBeNull();
    expect(await verifySessionToken("", env)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken({ uid: "u1", email: "owner@example.com" }, env);
    expect(await verifySessionToken(token, { ...env, SESSION_SECRET: "another-secret" })).toBeNull();
    expect(await verifySessionToken(token, { ...env, SESSION_SECRET: undefined })).toBeNull();
  });

  it("rejects an expired session", async () => {
    const token = await signSessionToken(
      { uid: "u1", email: "owner@example.com", iat: nowSeconds() - 500, exp: nowSeconds() - 1 },
      env.SESSION_SECRET
    );
    expect(await verifySessionToken(token, env)).toBeNull();
  });

  it("rejects a session whose email is no longer allowed", async () => {
    const token = await createSessionToken({ uid: "u1", email: "second@example.com" }, env);

    expect(await verifySessionToken(token, env)).not.toBeNull();
    expect(await verifySessionToken(token, { ...env, ADMIN_EMAILS: "owner@example.com" })).toBeNull();
  });

  it("rejects a missing or disabled account, and a revoked session", async () => {
    const token = await createSessionToken({ uid: "u1", email: "owner@example.com" }, env);

    mockGoogleFetch.mockResolvedValueOnce({ users: [] });
    expect(await verifySessionToken(token, env)).toBeNull();

    mockGoogleFetch.mockResolvedValueOnce({ users: [{ disabled: true }] });
    expect(await verifySessionToken(token, env)).toBeNull();

    mockGoogleFetch.mockResolvedValueOnce({ users: [{ validSince: String(nowSeconds() + 60) }] });
    expect(await verifySessionToken(token, env)).toBeNull();

    mockGoogleFetch.mockRejectedValueOnce(new Error("network"));
    expect(await verifySessionToken(token, env)).toBeNull();
  });

  it("looks the account up once, then reuses the result for five minutes", async () => {
    const token = await createSessionToken({ uid: "u1", email: "owner@example.com" }, env);

    await verifySessionToken(token, env);
    await verifySessionToken(token, env);
    expect(mockGoogleFetch).toHaveBeenCalledTimes(1);
    expect(mockGoogleFetch).toHaveBeenCalledWith(
      "https://identitytoolkit.googleapis.com/v1/projects/demo-project/accounts:lookup",
      { body: { localId: ["u1"] } }
    );

    const realNow = Date.now();
    const clock = jest.spyOn(Date, "now").mockReturnValue(realNow + 5 * 60 * 1000 + 1);
    await verifySessionToken(token, env);
    clock.mockRestore();
    expect(mockGoogleFetch).toHaveBeenCalledTimes(2);
  });

  it("sets Secure except on plain http", () => {
    const https = sessionCookie(new Request("https://t/api/admin/session"), "tok");
    const http = sessionCookie(new Request("http://localhost:8787/api/admin/session"), "tok");

    expect(https).toBe("tth_admin_session=tok; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=432000");
    expect(http).toBe("tth_admin_session=tok; HttpOnly; SameSite=Lax; Path=/; Max-Age=432000");
    expect(clearedSessionCookie(new Request("https://t/"))).toBe(
      "tth_admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );
  });
});

describe("verifyIdToken", () => {
  let keys: CryptoKeyPair;
  let otherKeys: CryptoKeyPair;
  let fetchMock: jest.SpyInstance;

  const generate = () =>
    crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"]
    ) as Promise<CryptoKeyPair>;

  async function makeToken(
    claims: Record<string, unknown> = {},
    options: { key?: CryptoKey; header?: Record<string, unknown> } = {}
  ) {
    const header = b64url(JSON.stringify({ alg: "RS256", kid: "kid-1", typ: "JWT", ...options.header }));
    const body = b64url(
      JSON.stringify({
        iss: "https://securetoken.google.com/demo-project",
        aud: "demo-project",
        sub: "user-1",
        email: "owner@example.com",
        email_verified: true,
        firebase: { sign_in_provider: "google.com" },
        iat: nowSeconds() - 10,
        exp: nowSeconds() + 3600,
        auth_time: nowSeconds() - 20,
        ...claims
      })
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      options.key || keys.privateKey,
      Buffer.from(`${header}.${body}`)
    );
    return `${header}.${body}.${b64url(signature)}`;
  }

  beforeAll(async () => {
    keys = await generate();
    otherKeys = await generate();
  });

  beforeEach(async () => {
    const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ keys: [{ ...jwk, kid: "kid-1", use: "sig" }] }), {
          headers: { "cache-control": "public, max-age=20000" }
        })
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("reports a password sign-in and an unverified email as such", async () => {
    const claims = await verifyIdToken(
      await makeToken({ email_verified: undefined, firebase: { sign_in_provider: "password" } })
    );
    expect(claims.emailVerified).toBe(false);
    expect(claims.signInProvider).toBe("password");
  });

  it("accepts a valid token and caches Google's keys", async () => {
    const claims = await verifyIdToken(await makeToken());
    expect(claims.uid).toBe("user-1");
    expect(claims.email).toBe("owner@example.com");
    expect(claims.emailVerified).toBe(true);
    expect(claims.signInProvider).toBe("google.com");

    await verifyIdToken(await makeToken());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
    );
  });

  it("refetches the keys once max-age has passed", async () => {
    await verifyIdToken(await makeToken());
    const token = await makeToken({ exp: nowSeconds() + 30000 });
    const realNow = Date.now();
    const clock = jest.spyOn(Date, "now").mockReturnValue(realNow + 20001 * 1000);
    await verifyIdToken(token);
    clock.mockRestore();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["wrong issuer", { iss: "https://securetoken.google.com/other" }],
    ["wrong audience", { aud: "other" }],
    ["expired", { exp: nowSeconds() - 1 }],
    ["issued in the future", { iat: nowSeconds() + 600 }],
    ["empty subject", { sub: "" }]
  ])("rejects a token with %s", async (_label, claims) => {
    await expect(verifyIdToken(await makeToken(claims))).rejects.toThrow();
  });

  it("allows five minutes of clock skew on iat", async () => {
    await expect(verifyIdToken(await makeToken({ iat: nowSeconds() + 120 }))).resolves.toBeTruthy();
  });

  it("rejects a bad signature, an unknown key, another algorithm and garbage", async () => {
    await expect(verifyIdToken(await makeToken({}, { key: otherKeys.privateKey }))).rejects.toThrow(
      "signature"
    );
    await expect(verifyIdToken(await makeToken({}, { header: { kid: "kid-2" } }))).rejects.toThrow(
      "unknown key"
    );
    await expect(verifyIdToken(await makeToken({}, { header: { alg: "none" } }))).rejects.toThrow(
      "algorithm"
    );
    await expect(verifyIdToken(await makeToken({}, { header: { alg: "HS256" } }))).rejects.toThrow(
      "algorithm"
    );
    await expect(verifyIdToken("abc")).rejects.toThrow();

    const [header, , signature] = (await makeToken()).split(".");
    const swapped = b64url(JSON.stringify({ sub: "attacker", aud: "demo-project" }));
    await expect(verifyIdToken(`${header}.${swapped}.${signature}`)).rejects.toThrow("signature");
  });
});
