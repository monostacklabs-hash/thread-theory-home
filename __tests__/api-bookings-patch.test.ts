/**
 * @jest-environment node
 */

jest.mock("@/worker/session", () => ({
  ...jest.requireActual("@/worker/session"),
  getAdminSession: jest.fn().mockResolvedValue({ uid: "admin", email: "owner@example.com" })
}));

jest.mock("@/lib/push", () => ({
  sendStatusPush: jest.fn().mockResolvedValue(undefined),
  STATUS_NOTIFICATIONS: {}
}));

jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn()
}));

import worker from "@/worker/index";
import type { Env } from "@/worker/env";
import { sendStatusPush } from "@/lib/push";
import { getAdminDb } from "@/lib/firebase/admin";

const mockSend = sendStatusPush as jest.MockedFunction<typeof sendStatusPush>;
const mockGetDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const env: Env = { ASSETS: { fetch: jest.fn() } };

function patch(bookingId: string, body: unknown) {
  const ctx = { waitUntil: jest.fn() };
  const request = new Request(`http://t/api/bookings/${bookingId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  return { ctx, response: worker.fetch(request, env, ctx) };
}

function mockBookingDoc(initial: Record<string, unknown>) {
  const state: Record<string, unknown> = { ...initial };
  return {
    set: jest.fn(async (updates: Record<string, unknown>) => {
      Object.assign(state, updates);
    }),
    get: jest.fn(async () => ({
      data: () => ({ ...state, createdAt: undefined, updatedAt: undefined })
    }))
  };
}

describe("PATCH /api/bookings/[bookingId] push trigger", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("fires sendStatusPush with the new status when status is in the payload", async () => {
    const docRef = mockBookingDoc({
      bookingId: "TTH-0042",
      name: "x",
      phone: "x",
      address: "x",
      product: "x",
      status: "preparing",
      token: "url-tok"
    });
    mockGetDb.mockReturnValue({
      collection: () => ({ doc: () => docRef })
    } as unknown as ReturnType<typeof getAdminDb>);

    const { ctx, response } = patch("TTH-0042", { status: "shipped" });
    const result = await response;

    expect(result.status).toBe(200);
    expect((await result.json()).booking.status).toBe("shipped");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      bookingId: "TTH-0042",
      token: "url-tok",
      status: "shipped"
    });
    // The push is handed to the runtime so it outlives the response.
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
  });

  it("does not fire sendStatusPush when payload has no status field", async () => {
    const docRef = mockBookingDoc({
      bookingId: "TTH-0043",
      name: "x",
      phone: "x",
      address: "x",
      product: "x",
      status: "preparing",
      token: "url-tok"
    });
    mockGetDb.mockReturnValue({
      collection: () => ({ doc: () => docRef })
    } as unknown as ReturnType<typeof getAdminDb>);

    const { ctx, response } = patch("TTH-0043", { notes: "updated note" });
    const result = await response;

    expect(result.status).toBe(200);
    expect(mockSend).not.toHaveBeenCalled();
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });

  it("rejects an unknown status and an empty update without writing", async () => {
    const docRef = mockBookingDoc({ bookingId: "TTH-0044", status: "preparing", token: "url-tok" });
    mockGetDb.mockReturnValue({
      collection: () => ({ doc: () => docRef })
    } as unknown as ReturnType<typeof getAdminDb>);

    const invalid = await patch("TTH-0044", { status: "lost" }).response;
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "Invalid booking status" });

    const empty = await patch("TTH-0044", {}).response;
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: "No fields to update" });

    const blank = await patch("TTH-0044", { name: "  " }).response;
    expect(blank.status).toBe(400);
    expect(await blank.json()).toEqual({ error: "name cannot be empty" });

    expect(docRef.set).not.toHaveBeenCalled();
  });
});
