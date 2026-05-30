/** @jest-environment node */

jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn()
}));

import { POST, DELETE } from "@/app/api/bookings/[bookingId]/subscriptions/route";
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

function req(path: string, method: string, body: unknown) {
  return new Request(`http://t${path}`, { method, body: JSON.stringify(body) });
}

describe("POST /api/bookings/[bookingId]/subscriptions", () => {
  it("returns 400 when fields are missing", async () => {
    mockBookingDb({ status: "preparing", token: "tok" }, new Map());
    const r = await POST(req("/x", "POST", {}), {
      params: Promise.resolve({ bookingId: "TTH-1" })
    });
    expect(r.status).toBe(400);
  });

  it("returns 404 when urlToken does not match", async () => {
    mockBookingDb({ status: "preparing", token: "right" }, new Map());
    const r = await POST(
      req("/x", "POST", { urlToken: "wrong", fcmToken: "fcm" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(404);
  });

  it("returns 410 when booking is delivered", async () => {
    mockBookingDb({ status: "delivered", token: "tok" }, new Map());
    const r = await POST(
      req("/x", "POST", { urlToken: "tok", fcmToken: "fcm" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(410);
  });

  it("returns 429 when subcollection has 10+ subscriptions", async () => {
    const subs: SubDocs = new Map();
    for (let i = 0; i < 10; i++) subs.set(`h${i}`, { token: `t${i}`, lastSeenAt: 0 });
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await POST(
      req("/x", "POST", { urlToken: "tok", fcmToken: "new" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(429);
  });

  it("upserts the token doc keyed by sha256(fcmToken)", async () => {
    const subs: SubDocs = new Map();
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await POST(
      req("/x", "POST", { urlToken: "tok", fcmToken: "fcm-xyz", userAgent: "Mozilla" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );

    expect(r.status).toBe(200);
    expect(subs.has(tokenHash("fcm-xyz"))).toBe(true);
    expect(subs.get(tokenHash("fcm-xyz"))?.token).toBe("fcm-xyz");
  });
});

describe("DELETE /api/bookings/[bookingId]/subscriptions", () => {
  it("returns 404 when urlToken does not match", async () => {
    mockBookingDb({ status: "preparing", token: "right" }, new Map());
    const r = await DELETE(
      req("/x", "DELETE", { urlToken: "wrong", fcmToken: "fcm" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(404);
  });

  it("deletes the token doc and returns 200", async () => {
    const hash = tokenHash("fcm-zzz");
    const subs: SubDocs = new Map([[hash, { token: "fcm-zzz", lastSeenAt: 0 }]]);
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await DELETE(
      req("/x", "DELETE", { urlToken: "tok", fcmToken: "fcm-zzz" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );

    expect(r.status).toBe(200);
    expect(subs.has(hash)).toBe(false);
  });

  it("returns 200 when token doc does not exist (idempotent)", async () => {
    mockBookingDb({ status: "preparing", token: "tok" }, new Map());
    const r = await DELETE(
      req("/x", "DELETE", { urlToken: "tok", fcmToken: "absent" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(200);
  });
});
