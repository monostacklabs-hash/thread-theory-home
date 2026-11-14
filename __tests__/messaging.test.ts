/**
 * @jest-environment node
 */

import { GoogleApiError } from "@/lib/firebase/google-auth";
import { toMessagingErrorCode } from "@/lib/firebase/messaging";

function fcmError(httpStatus: number, status: string, errorCode?: string) {
  return new GoogleApiError("failed", httpStatus, status, {
    error: { status, details: errorCode ? [{ errorCode }] : [] }
  });
}

describe("toMessagingErrorCode", () => {
  it("maps an unregistered token to the code that prunes it", () => {
    expect(toMessagingErrorCode(fcmError(404, "NOT_FOUND", "UNREGISTERED"))).toBe(
      "messaging/registration-token-not-registered"
    );
  });

  it("maps a malformed token to invalid-argument", () => {
    expect(toMessagingErrorCode(fcmError(400, "INVALID_ARGUMENT", "INVALID_ARGUMENT"))).toBe(
      "messaging/invalid-argument"
    );
  });

  it("does not prune on transient or unknown failures", () => {
    expect(toMessagingErrorCode(fcmError(503, "UNAVAILABLE", "UNAVAILABLE"))).toBe(
      "messaging/server-unavailable"
    );
    expect(toMessagingErrorCode(new Error("network"))).toBe("messaging/unknown-error");
  });
});
