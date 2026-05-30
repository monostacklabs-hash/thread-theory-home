/**
 * @jest-environment node
 */

jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    after: (cb: () => unknown) => cb()
  };
});

jest.mock("@/lib/auth", () => ({
  getAdminSession: jest.fn().mockResolvedValue({ uid: "admin" })
}));

jest.mock("@/lib/push", () => ({
  sendStatusPush: jest.fn().mockResolvedValue(undefined),
  STATUS_NOTIFICATIONS: {}
}));

jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn()
}));

import { PATCH } from "@/app/api/bookings/[bookingId]/route";
import { sendStatusPush } from "@/lib/push";
import { getAdminDb } from "@/lib/firebase/admin";

const mockSend = sendStatusPush as jest.MockedFunction<typeof sendStatusPush>;
const mockGetDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

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

    const req = new Request("http://t/api/bookings/TTH-0042", {
      method: "PATCH",
      body: JSON.stringify({ status: "shipped" })
    });

    await PATCH(req, { params: Promise.resolve({ bookingId: "TTH-0042" }) });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      bookingId: "TTH-0042",
      token: "url-tok",
      status: "shipped"
    });
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

    const req = new Request("http://t/api/bookings/TTH-0043", {
      method: "PATCH",
      body: JSON.stringify({ notes: "updated note" })
    });

    await PATCH(req, { params: Promise.resolve({ bookingId: "TTH-0043" }) });

    expect(mockSend).not.toHaveBeenCalled();
  });
});
