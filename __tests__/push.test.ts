import { STATUS_NOTIFICATIONS, tokenHash } from "@/lib/push";

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
