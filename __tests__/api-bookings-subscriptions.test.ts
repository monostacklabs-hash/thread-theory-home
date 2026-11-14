/** @jest-environment node */

jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn()
}));

import worker from "@/worker/index";
import type { Env } from "@/worker/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { tokenHash } from "@/lib/push";

const mockGetDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

type SubDocState = { token: string; lastSeenAt: unknown };
type SubDocs = Map<string, SubDocState>;

function mockBookingDb(
  booking: { status: string; token: string } | null,
  subs: SubDocs
) {
  const subDocFor = (hash: string) => ({
    set: jest.fn(async (v: SubDocState) => {
      subs.set(hash, { ...subs.get(hash), ...v });
    }),
    delete: jest.fn(async () => {
      subs.delete(hash);
    }),
    get: jest.fn(async () => ({ exists: subs.has(hash) }))
  });

  const subCollection = {
    doc: (hash: string) => subDocFor(hash),
    get: jest.fn(async () => ({
      size: subs.size,
      docs: Array.from(subs.keys()).map((id) => ({ id }))
    }))
  };

  const bookingDoc = {
    get: jest.fn(async () => ({ exists: booking !== null, data: () => booking })),
    collection: () => subCollection
  };

  mockGetDb.mockReturnValue({
    collection: () => ({ doc: () => bookingDoc })
  } as unknown as ReturnType<typeof getAdminDb>);

  return { subs, subCollection };
}

const env: Env = { ASSETS: { fetch: jest.fn() } };

function call(method: "POST" | "DELETE", body: unknown) {
  const request = new Request("http://t/api/bookings/TTH-1/subscriptions", {
    method,
    body: JSON.stringify(body)
  });
  return worker.fetch(request, env, { waitUntil: jest.fn() });
}

describe("POST /api/bookings/[bookingId]/subscriptions", () => {
  it("returns 400 when fields are missing", async () => {
    mockBookingDb({ status: "preparing", token: "tok" }, new Map());
    const r = await call("POST", {});
    expect(r.status).toBe(400);
  });

  it("returns 404 when urlToken does not match", async () => {
    mockBookingDb({ status: "preparing", token: "right" }, new Map());
    const r = await call("POST", { urlToken: "wrong", fcmToken: "fcm" });
    expect(r.status).toBe(404);
  });

  it("returns 410 when booking is delivered", async () => {
    mockBookingDb({ status: "delivered", token: "tok" }, new Map());
    const r = await call("POST", { urlToken: "tok", fcmToken: "fcm" });
    expect(r.status).toBe(410);
  });

  it("returns 429 when subcollection has 10+ subscriptions", async () => {
    const subs: SubDocs = new Map();
    for (let i = 0; i < 10; i++) subs.set(`h${i}`, { token: `t${i}`, lastSeenAt: 0 });
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await call("POST", { urlToken: "tok", fcmToken: "new" });
    expect(r.status).toBe(429);
  });

  it("upserts the token doc keyed by sha256(fcmToken)", async () => {
    const subs: SubDocs = new Map();
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await call("POST", { urlToken: "tok", fcmToken: "fcm-xyz", userAgent: "Mozilla" });

    expect(r.status).toBe(200);
    expect(subs.has(tokenHash("fcm-xyz"))).toBe(true);
    expect(subs.get(tokenHash("fcm-xyz"))?.token).toBe("fcm-xyz");
  });
});

describe("DELETE /api/bookings/[bookingId]/subscriptions", () => {
  it("returns 404 when urlToken does not match", async () => {
    mockBookingDb({ status: "preparing", token: "right" }, new Map());
    const r = await call("DELETE", { urlToken: "wrong", fcmToken: "fcm" });
    expect(r.status).toBe(404);
  });

  it("deletes the token doc and returns 200", async () => {
    const hash = tokenHash("fcm-zzz");
    const subs: SubDocs = new Map([[hash, { token: "fcm-zzz", lastSeenAt: 0 }]]);
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await call("DELETE", { urlToken: "tok", fcmToken: "fcm-zzz" });

    expect(r.status).toBe(200);
    expect(subs.has(hash)).toBe(false);
  });

  it("returns 200 when token doc does not exist (idempotent)", async () => {
    mockBookingDb({ status: "preparing", token: "tok" }, new Map());
    const r = await call("DELETE", { urlToken: "tok", fcmToken: "absent" });
    expect(r.status).toBe(200);
  });
});
