jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn(),
  getAdminMessaging: jest.fn()
}));

import { STATUS_NOTIFICATIONS, tokenHash, sendStatusPush } from "@/lib/push";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/admin";

type MockedFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;
const mockGetAdminDb = getAdminDb as MockedFn<typeof getAdminDb>;
const mockGetAdminMessaging = getAdminMessaging as MockedFn<typeof getAdminMessaging>;

describe("STATUS_NOTIFICATIONS", () => {
  it("defines title and body for confirmed, preparing, shipped, delivered, cancelled", () => {
    expect(STATUS_NOTIFICATIONS.confirmed).toEqual({
      title: "Order confirmed",
      body: "We've accepted your order. Packing soon."
    });
    expect(STATUS_NOTIFICATIONS.preparing).toEqual({
      title: "Preparing your order",
      body: "Your bedsheets are being folded and packed."
    });
    expect(STATUS_NOTIFICATIONS.shipped).toEqual({
      title: "On the way",
      body: "Your parcel is with the courier. Tap to track."
    });
    expect(STATUS_NOTIFICATIONS.delivered).toEqual({
      title: "Delivered",
      body: "Hope you love your bedsheets. Thanks for choosing us."
    });
    expect(STATUS_NOTIFICATIONS.cancelled).toEqual({
      title: "Order cancelled",
      body: "Reach out on Instagram if this looks wrong."
    });
  });

  it("does not define a notification for order_received", () => {
    expect(STATUS_NOTIFICATIONS.order_received).toBeUndefined();
  });
});

describe("tokenHash", () => {
  it("returns a stable sha256 hex string", () => {
    const hash = tokenHash("example-fcm-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash("example-fcm-token")).toBe(hash);
  });

  it("returns different hashes for different inputs", () => {
    expect(tokenHash("a")).not.toBe(tokenHash("b"));
  });
});

describe("sendStatusPush", () => {
  let sendEachForMulticast: jest.Mock;
  let docs: Array<{ id: string; data: () => { token: string }; ref: { delete: jest.Mock } }>;
  let collectionGet: jest.Mock;
  let firestoreDocDelete: jest.Mock;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    sendEachForMulticast = jest.fn();
    firestoreDocDelete = jest.fn().mockResolvedValue(undefined);
    docs = [];
    collectionGet = jest.fn(async () => ({ docs }));

    mockGetAdminDb.mockReturnValue({
      collection: () => ({
        doc: () => ({
          collection: () => ({
            get: collectionGet
          })
        })
      })
    } as unknown as ReturnType<typeof getAdminDb>);

    mockGetAdminMessaging.mockReturnValue({
      sendEachForMulticast
    } as unknown as ReturnType<typeof getAdminMessaging>);
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("does nothing when no tokens are subscribed", async () => {
    await sendStatusPush({ bookingId: "TTH-0001", token: "url-tok", status: "shipped" });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("multicasts the configured notification + link for a status with subscribers", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://threadtheoryhome.in";
    docs = [
      { id: "h1", data: () => ({ token: "fcm-a" }), ref: { delete: firestoreDocDelete } },
      { id: "h2", data: () => ({ token: "fcm-b" }), ref: { delete: firestoreDocDelete } }
    ];
    sendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }]
    });

    await sendStatusPush({ bookingId: "TTH-0007", token: "url-tok", status: "shipped" });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ["fcm-a", "fcm-b"],
      notification: STATUS_NOTIFICATIONS.shipped,
      webpush: {
        fcmOptions: {
          link: "https://threadtheoryhome.in/order/TTH-0007?token=url-tok"
        }
      }
    });
  });

  it("deletes token docs whose responses indicate registration is gone", async () => {
    docs = [
      {
        id: "h1",
        data: () => ({ token: "good" }),
        ref: { delete: jest.fn().mockResolvedValue(undefined) }
      },
      {
        id: "h2",
        data: () => ({ token: "stale" }),
        ref: { delete: jest.fn().mockResolvedValue(undefined) }
      }
    ];
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: "messaging/registration-token-not-registered" } }
      ]
    });

    await sendStatusPush({ bookingId: "TTH-0008", token: "url-tok", status: "shipped" });

    expect(docs[0].ref.delete).not.toHaveBeenCalled();
    expect(docs[1].ref.delete).toHaveBeenCalledTimes(1);
  });

  it("empties the fcmTokens subcollection on terminal status", async () => {
    const del1 = jest.fn().mockResolvedValue(undefined);
    const del2 = jest.fn().mockResolvedValue(undefined);
    docs = [
      { id: "h1", data: () => ({ token: "t1" }), ref: { delete: del1 } },
      { id: "h2", data: () => ({ token: "t2" }), ref: { delete: del2 } }
    ];
    sendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }]
    });

    await sendStatusPush({ bookingId: "TTH-0009", token: "url-tok", status: "delivered" });

    expect(del1).toHaveBeenCalled();
    expect(del2).toHaveBeenCalled();
  });

  it("does not throw when FCM rejects", async () => {
    docs = [{ id: "h1", data: () => ({ token: "t" }), ref: { delete: jest.fn() } }];
    sendEachForMulticast.mockRejectedValue(new Error("FCM is down"));

    await expect(
      sendStatusPush({ bookingId: "TTH-0010", token: "url-tok", status: "shipped" })
    ).resolves.toBeUndefined();
  });
});
