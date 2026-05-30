jest.mock("@/lib/firebase/client", () => ({
  getFirebaseMessaging: jest.fn().mockResolvedValue(null)
}));

import { render } from "@testing-library/react";
import { NotifyCard } from "@/app/order/[bookingId]/notify-card";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true
  });
}

function setMatchMedia(standalone: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query === "(display-mode: standalone)" ? standalone : false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }));
}

describe("<NotifyCard />", () => {
  beforeEach(() => {
    setMatchMedia(false);
  });

  it("renders nothing when serviceWorker is unavailable", () => {
    // jsdom default: no serviceWorker
    delete (window.navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    const { container } = render(
      <NotifyCard bookingId="TTH-1" token="t" status="preparing" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on terminal status", () => {
    (window.navigator as unknown as { serviceWorker: object }).serviceWorker = {};
    (window as unknown as { PushManager: object }).PushManager = {};
    const { container } = render(
      <NotifyCard bookingId="TTH-1" token="t" status="delivered" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the iOS hint card on iPhone Safari without standalone", () => {
    (window.navigator as unknown as { serviceWorker: object }).serviceWorker = {};
    (window as unknown as { PushManager: object }).PushManager = {};
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari");
    setMatchMedia(false);

    const { getByText, queryByRole } = render(
      <NotifyCard bookingId="TTH-1" token="t" status="preparing" />
    );

    expect(getByText(/Add to Home Screen/i)).toBeInTheDocument();
    expect(queryByRole("button", { name: /notify me/i })).toBeNull();
  });

  it("renders the idle CTA on Android Chrome", () => {
    (window.navigator as unknown as { serviceWorker: object }).serviceWorker = {};
    (window as unknown as { PushManager: object }).PushManager = {};
    (window as unknown as { Notification: { permission: string } }).Notification = {
      permission: "default"
    };
    setUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120");
    setMatchMedia(false);

    const { getByRole } = render(
      <NotifyCard bookingId="TTH-1" token="t" status="preparing" />
    );

    expect(getByRole("button", { name: /notify me/i })).toBeInTheDocument();
  });
});
