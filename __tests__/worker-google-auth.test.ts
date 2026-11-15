/** @jest-environment node */

import {
  getAccessToken,
  resetAccessTokenCache,
  setTokenCache,
  type TokenCacheStore
} from "@/lib/firebase/google-auth";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const KV_KEY = "google-access-token";

let publicKey: CryptoKey;
let fetchMock: jest.SpyInstance;
let minted = 0;

function memoryKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const kv = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    put: jest.fn(async (key: string, value: string, _options?: { expirationTtl?: number }) => {
      store.set(key, value);
    })
  };
  return { kv: kv satisfies TokenCacheStore, store };
}

beforeAll(async () => {
  const keys = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;
  publicKey = keys.publicKey;

  const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;

  process.env.FIREBASE_PROJECT_ID = "demo-project";
  process.env.FIREBASE_CLIENT_EMAIL = "svc@demo-project.iam.gserviceaccount.com";
  // Stored the way .env files and Worker secrets hold it: literal "\n".
  process.env.FIREBASE_PRIVATE_KEY = pem.replace(/\n/g, "\\n");
});

beforeEach(() => {
  minted = 0;
  resetAccessTokenCache();
  setTokenCache(null);
  fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
    minted += 1;
    return new Response(JSON.stringify({ access_token: `minted-${minted}`, expires_in: 3600 }));
  });
});

afterEach(() => {
  fetchMock.mockRestore();
});

describe("getAccessToken", () => {
  it("signs a service-account assertion Google can verify and exchanges it", async () => {
    expect(await getAccessToken()).toBe("minted-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TOKEN_URL);
    expect(init.method).toBe("POST");

    const params = init.body as URLSearchParams;
    expect(params.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");

    const [header, claims, signature] = params.get("assertion")!.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });

    const decoded = JSON.parse(Buffer.from(claims, "base64url").toString());
    expect(decoded).toMatchObject({
      iss: "svc@demo-project.iam.gserviceaccount.com",
      sub: "svc@demo-project.iam.gserviceaccount.com",
      aud: TOKEN_URL
    });
    expect(decoded.exp - decoded.iat).toBe(3600);
    expect(decoded.scope.split(" ")).toEqual([
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/firebase.messaging",
      "https://www.googleapis.com/auth/identitytoolkit"
    ]);

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      Buffer.from(signature, "base64url"),
      Buffer.from(`${header}.${claims}`)
    );
    expect(valid).toBe(true);
  });

  it("reuses the module-scope token and shares one mint between concurrent callers", async () => {
    const [first, second] = await Promise.all([getAccessToken(), getAccessToken()]);
    expect(first).toBe("minted-1");
    expect(second).toBe("minted-1");
    expect(await getAccessToken()).toBe("minted-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses a fresh token from KV instead of minting", async () => {
    const { kv } = memoryKv({
      [KV_KEY]: JSON.stringify({ token: "from-kv", expiresAt: Date.now() + 30 * 60 * 1000 })
    });
    setTokenCache(kv);

    expect(await getAccessToken()).toBe("from-kv");
    expect(await getAccessToken()).toBe("from-kv");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(kv.get).toHaveBeenCalledTimes(1);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("mints and writes to KV when KV is empty, with a TTL short of the expiry margin", async () => {
    const { kv, store } = memoryKv();
    setTokenCache(kv);

    expect(await getAccessToken()).toBe("minted-1");

    expect(kv.put).toHaveBeenCalledTimes(1);
    const [key, value, options] = kv.put.mock.calls[0];
    expect(key).toBe(KV_KEY);
    expect(JSON.parse(value).token).toBe("minted-1");
    expect(JSON.parse(store.get(KV_KEY)!).expiresAt).toBeGreaterThan(Date.now() + 3500 * 1000);
    expect(options?.expirationTtl).toBeGreaterThan(3290);
    expect(options?.expirationTtl).toBeLessThanOrEqual(3300);
  });

  it("ignores a KV token inside the five-minute margin, and malformed entries", async () => {
    const stale = memoryKv({
      [KV_KEY]: JSON.stringify({ token: "stale", expiresAt: Date.now() + 4 * 60 * 1000 })
    });
    setTokenCache(stale.kv);
    expect(await getAccessToken()).toBe("minted-1");

    resetAccessTokenCache();
    setTokenCache(memoryKv({ [KV_KEY]: "not json" }).kv);
    expect(await getAccessToken()).toBe("minted-2");
  });

  it("never writes a KV TTL below 60 seconds", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ access_token: "short", expires_in: 310 }))
    );
    const { kv } = memoryKv();
    setTokenCache(kv);

    await getAccessToken();
    expect(kv.put.mock.calls[0][2]).toEqual({ expirationTtl: 60 });
  });

  it("falls back to minting when KV throws on read and on write", async () => {
    const kv = {
      get: jest.fn(async () => {
        throw new Error("KV down");
      }),
      put: jest.fn(async () => {
        throw new Error("KV down");
      })
    };
    setTokenCache(kv);

    expect(await getAccessToken()).toBe("minted-1");
    expect(kv.get).toHaveBeenCalled();
    expect(kv.put).toHaveBeenCalled();
  });

  it("reports a failed exchange", async () => {
    fetchMock.mockImplementation(async () => new Response("denied", { status: 400 }));
    await expect(getAccessToken()).rejects.toThrow("Google token exchange failed (400): denied");
  });
});
