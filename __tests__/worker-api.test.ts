/** @jest-environment node */

jest.mock("@/lib/firebase/google-auth", () => ({
  getProjectId: () => "demo-project",
  googleFetch: jest.fn(),
  setTokenCache: jest.fn()
}));

jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn()
}));

import worker from "@/worker/index";
import type { Env } from "@/worker/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { googleFetch } from "@/lib/firebase/google-auth";
import { ADMIN_COOKIE_NAME, createSessionToken, resetSessionCaches } from "@/worker/session";

const mockGetDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGoogleFetch = googleFetch as jest.MockedFunction<typeof googleFetch>;

const env: Env = {
  ASSETS: { fetch: jest.fn() },
  SITE_URL: "https://threadtheoryhome.in/",
  ADMIN_EMAILS: "owner@example.com",
  SESSION_SECRET: "test-secret-please-ignore"
};

const BOOKING = {
  bookingId: "TTH-0007",
  name: "Priya Raman",
  phone: "+91 98765 43210",
  email: "priya.raman@example.com",
  instagramHandle: "priya.home",
  address: "12 Lake View Road, Kochi 682001",
  product: "Ivory percale set",
  instagramPostUrl: "https://www.instagram.com/p/abc123/",
  indiaPostTrackingNumber: "EK123456789IN",
  notes: "Gift wrap",
  status: "shipped",
  token: "secret-tracking-token",
  createdAt: { toDate: () => new Date("2026-11-01T10:00:00.000Z") },
  updatedAt: { toDate: () => new Date("2026-11-02T10:00:00.000Z") }
};

/** A fake Firestore holding bookings by id. */
function mockDb(bookings: Record<string, Record<string, unknown>>) {
  const store = new Map(Object.entries(bookings));
  const doc = (id: string) => ({
    get: jest.fn(async () => ({ exists: store.has(id), data: () => store.get(id) })),
    set: jest.fn(async (updates: Record<string, unknown>) => {
      store.set(id, { ...store.get(id), ...updates });
    })
  });
  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn(doc),
      orderBy: jest.fn(() => ({
        get: async () => ({ docs: Array.from(store.values()).map((data) => ({ data: () => data })) })
      }))
    }))
  };
  mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getAdminDb>);
  return { db, store };
}

async function call(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}
) {
  const request = new Request(`${init.origin || "https://threadtheoryhome.in"}${path}`, {
    method: init.method || "GET",
    headers: init.cookie ? { cookie: init.cookie } : {},
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
  return worker.fetch(request, env, { waitUntil: jest.fn() });
}

async function adminCookie(email = "owner@example.com") {
  return `${ADMIN_COOKIE_NAME}=${await createSessionToken({ uid: "admin-uid", email }, env)}`;
}

beforeEach(() => {
  resetSessionCaches();
  mockGetDb.mockReset();
  mockGoogleFetch.mockReset();
  mockGoogleFetch.mockResolvedValue({ users: [{ validSince: "1000" }] });
});

describe("GET /api/orders/:id", () => {
  it("returns the masked order for the right token", async () => {
    mockDb({ "TTH-0007": BOOKING });
    const response = await call("/api/orders/TTH-0007?token=secret-tracking-token");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      order: {
        bookingId: "TTH-0007",
        status: "shipped",
        product: "Ivory percale set",
        instagramPostUrl: "https://www.instagram.com/p/abc123/",
        notes: "Gift wrap",
        indiaPostTrackingNumber: "EK123456789IN",
        createdAt: "2026-11-01T10:00:00.000Z",
        maskedName: "Pr*********",
        maskedPhone: "••••••3210",
        maskedEmail: "pr***@example.com",
        maskedAddress: "Address hidden for privacy"
      }
    });
  });

  it("never includes raw personal details or the token", async () => {
    mockDb({ "TTH-0007": BOOKING });
    const text = await (await call("/api/orders/TTH-0007?token=secret-tracking-token")).text();

    for (const secret of [
      "Priya",
      "Raman",
      "98765",
      "priya.raman",
      "priya.home",
      "Lake View",
      "682001",
      "secret-tracking-token"
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(Object.keys(JSON.parse(text).order).sort()).toEqual(
      [
        "bookingId",
        "createdAt",
        "indiaPostTrackingNumber",
        "instagramPostUrl",
        "maskedAddress",
        "maskedEmail",
        "maskedName",
        "maskedPhone",
        "notes",
        "product",
        "status"
      ].sort()
    );
  });

  it("returns null for a missing email and a blank address", async () => {
    mockDb({ "TTH-0007": { ...BOOKING, email: null, address: "   ", instagramPostUrl: "", notes: undefined } });
    const { order } = await (await call("/api/orders/TTH-0007?token=secret-tracking-token")).json();

    expect(order.maskedEmail).toBeNull();
    expect(order.maskedAddress).toBeNull();
    expect(order.instagramPostUrl).toBeNull();
    expect(order.notes).toBe("");
  });

  it.each([
    ["a wrong token", "/api/orders/TTH-0007?token=wrong"],
    ["no token", "/api/orders/TTH-0007"],
    ["an empty token", "/api/orders/TTH-0007?token="],
    ["an unknown booking", "/api/orders/TTH-9999?token=secret-tracking-token"]
  ])("returns 404 for %s", async (_label, path) => {
    mockDb({ "TTH-0007": BOOKING });
    const response = await call(path);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("returns 404 when the stored booking has no token", async () => {
    mockDb({ "TTH-0007": { ...BOOKING, token: undefined } });
    expect((await call("/api/orders/TTH-0007?token=undefined")).status).toBe(404);
  });
});

describe("admin endpoints without a session", () => {
  it.each([
    ["GET", "/api/admin/me"],
    ["GET", "/api/bookings"],
    ["POST", "/api/bookings"],
    ["GET", "/api/bookings/TTH-0007"],
    ["PATCH", "/api/bookings/TTH-0007"],
    ["POST", "/api/bookings/TTH-0007/token"]
  ])("%s %s returns 401 and never touches Firestore", async (method, path) => {
    const body = method === "GET" ? undefined : { status: "shipped" };

    const none = await call(path, { method, body });
    expect(none.status).toBe(401);
    expect(await none.json()).toEqual({ error: "Unauthorized" });

    const forged = await call(path, { method, body, cookie: `${ADMIN_COOKIE_NAME}=abc.def` });
    expect(forged.status).toBe(401);

    const notAllowed = await call(path, { method, body, cookie: await adminCookie("stranger@example.com") });
    expect(notAllowed.status).toBe(401);

    expect(mockGetDb).not.toHaveBeenCalled();
  });
});

describe("admin endpoints with a session", () => {
  it("GET /api/admin/me returns the email", async () => {
    const response = await call("/api/admin/me", { cookie: await adminCookie() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: "owner@example.com" });
  });

  it("GET /api/bookings lists bookings ordered by createdAt desc", async () => {
    const { db } = mockDb({ "TTH-0007": BOOKING });
    const response = await call("/api/bookings", { cookie: await adminCookie() });
    const { bookings } = await response.json();

    expect(response.status).toBe(200);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toEqual({
      ...BOOKING,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-02T10:00:00.000Z"
    });
    const collection = db.collection.mock.results[0].value;
    expect(collection.orderBy).toHaveBeenCalledWith("createdAt", "desc");
  });

  it("GET /api/bookings/:id returns the booking or 404", async () => {
    mockDb({ "TTH-0007": BOOKING });
    const cookie = await adminCookie();

    const found = await call("/api/bookings/TTH-0007", { cookie });
    expect(found.status).toBe(200);
    expect((await found.json()).booking.name).toBe("Priya Raman");

    const missing = await call("/api/bookings/TTH-9999", { cookie });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Booking not found" });
  });

  it("POST /api/bookings validates input", async () => {
    mockDb({});
    const response = await call("/api/bookings", {
      method: "POST",
      cookie: await adminCookie(),
      body: { name: "A", phone: "1", address: "x" }
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing required field: product" });
  });

  it("POST /api/bookings creates the next booking id and a tracking link from SITE_URL", async () => {
    const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
    const transaction = {
      get: jest.fn(async () => ({ exists: true, data: () => ({ bookingCount: 41 }) })),
      set: jest.fn((ref: { path: string }, data: Record<string, unknown>) => {
        writes.push({ path: ref.path, data });
      })
    };
    mockGetDb.mockReturnValue({
      collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
      runTransaction: (run: (t: typeof transaction) => Promise<unknown>) => run(transaction)
    } as unknown as ReturnType<typeof getAdminDb>);

    const response = await call("/api/bookings", {
      method: "POST",
      cookie: await adminCookie(),
      body: { name: " Priya ", phone: "999", address: "Kochi", product: "Set", instagramHandle: "@Priya.Home" }
    });
    const { booking, trackingUrl } = await response.json();

    expect(response.status).toBe(200);
    expect(booking).toMatchObject({
      bookingId: "TTH-0042",
      name: "Priya",
      email: null,
      instagramHandle: "priya.home",
      notes: "",
      status: "order_received"
    });
    expect(booking.token).toMatch(/^[0-9a-f]{48}$/);
    expect(trackingUrl).toBe(`https://threadtheoryhome.in/order/TTH-0042?token=${booking.token}`);
    expect(writes[0]).toEqual({ path: "meta/counters", data: { bookingCount: 42 } });
    expect(writes[1].path).toBe("bookings/TTH-0042");
    expect(writes[1].data).toMatchObject({ bookingId: "TTH-0042", token: booking.token, status: "order_received" });
  });

  it("POST /api/bookings/:id/token issues a new token, or 404 for an unknown booking", async () => {
    const { store } = mockDb({ "TTH-0007": BOOKING });
    const cookie = await adminCookie();

    const response = await call("/api/bookings/TTH-0007/token", { method: "POST", cookie });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bookingId).toBe("TTH-0007");
    expect(body.token).toMatch(/^[0-9a-f]{48}$/);
    expect(body.token).not.toBe("secret-tracking-token");
    expect(body.trackingUrl).toBe(`https://threadtheoryhome.in/order/TTH-0007?token=${body.token}`);
    expect(store.get("TTH-0007")?.token).toBe(body.token);
  });
});

describe("POST /api/admin/session and /api/admin/logout", () => {
  it("returns 400 without an ID token", async () => {
    const response = await call("/api/admin/session", { method: "POST", body: {} });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing ID token" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns 401 for a token that does not verify, or a body that is not JSON", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const bad = await call("/api/admin/session", { method: "POST", body: { idToken: "a.b.c" } });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: "Could not create admin session" });
    expect(bad.headers.get("set-cookie")).toBeNull();

    const request = new Request("https://threadtheoryhome.in/api/admin/session", { method: "POST", body: "nope" });
    const notJson = await worker.fetch(request, env, { waitUntil: jest.fn() });
    expect(notJson.status).toBe(401);

    error.mockRestore();
  });

  it("logout clears the cookie", async () => {
    const response = await call("/api/admin/logout", { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toBe(
      "tth_admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );
  });
});

describe("POST /api/admin/session sign-in", () => {
  let keys: CryptoKeyPair;
  let fetchMock: jest.SpyInstance;

  const b64url = (value: string | ArrayBuffer) => Buffer.from(value as string).toString("base64url");

  async function idToken(claims: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", kid: "kid-1" }));
    const body = b64url(
      JSON.stringify({
        iss: "https://securetoken.google.com/demo-project",
        aud: "demo-project",
        sub: "admin-uid",
        email: "Owner@Example.com",
        iat: now - 5,
        exp: now + 3600,
        auth_time: now - 5,
        ...claims
      })
    );
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keys.privateKey,
      Buffer.from(`${header}.${body}`)
    );
    return `${header}.${body}.${b64url(signature)}`;
  }

  beforeAll(async () => {
    keys = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"]
    )) as CryptoKeyPair;
  });

  beforeEach(async () => {
    const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: "kid-1" }] })));
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("sets a session cookie that then authorises admin calls", async () => {
    const response = await call("/api/admin/session", { method: "POST", body: { idToken: await idToken() } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const setCookie = response.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(
      /^tth_admin_session=[\w-]+\.[\w-]+; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=432000$/
    );

    const me = await call("/api/admin/me", { cookie: setCookie.split(";")[0] });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ email: "Owner@Example.com" });
  });

  it("omits Secure on plain http (local dev)", async () => {
    const response = await call("/api/admin/session", {
      method: "POST",
      body: { idToken: await idToken() },
      origin: "http://localhost:8787"
    });

    expect(response.headers.get("set-cookie")).toMatch(/; HttpOnly; SameSite=Lax; Path=\/; Max-Age=432000$/);
  });

  it("returns 403 for an email that is not on the allow list", async () => {
    const response = await call("/api/admin/session", {
      method: "POST",
      body: { idToken: await idToken({ email: "stranger@example.com" }) }
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "This account is not allowed" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns 401 when the account is disabled or its sessions were revoked after sign-in", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);

    mockGoogleFetch.mockResolvedValueOnce({ users: [{ disabled: true }] });
    const disabled = await call("/api/admin/session", { method: "POST", body: { idToken: await idToken() } });
    expect(disabled.status).toBe(401);
    expect(disabled.headers.get("set-cookie")).toBeNull();

    mockGoogleFetch.mockResolvedValueOnce({ users: [{ validSince: String(Math.floor(Date.now() / 1000) + 30) }] });
    const revoked = await call("/api/admin/session", { method: "POST", body: { idToken: await idToken() } });
    expect(revoked.status).toBe(401);
    expect(await revoked.json()).toEqual({ error: "Could not create admin session" });

    error.mockRestore();
  });
});
