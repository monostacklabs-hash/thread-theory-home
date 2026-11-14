const mockReplaceLocation = jest.fn();
jest.mock("@/components/admin/navigate", () => ({
  replaceLocation: (url: string) => mockReplaceLocation(url),
  assignLocation: jest.fn()
}));

let mockSearch = "";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch)
}));

jest.mock("@/app/admin/shipping-label/shipping-label-client", () => ({
  __esModule: true,
  default: ({ initialRecipients }: { initialRecipients: unknown[] }) => (
    <pre data-testid="recipients">{JSON.stringify(initialRecipients)}</pre>
  )
}));

import { render, screen, waitFor } from "@testing-library/react";
import {
  normalizeBookingIds,
  ShippingLabelLoader
} from "@/app/admin/shipping-label/shipping-label-loader";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

function booking(id: string) {
  return { bookingId: id, name: `Name ${id}`, phone: "9876543210", address: `Address ${id}` };
}

/** Answers /api/admin/me and /api/bookings/:id; ids in `missing` answer 404. */
function mockApi({ meStatus = 200, missing = [] as string[] } = {}) {
  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/admin/me") {
      return Promise.resolve(jsonResponse(meStatus, { email: "team@example.com" }));
    }
    const id = decodeURIComponent(url.replace("/api/bookings/", ""));
    if (missing.includes(id)) {
      return Promise.resolve(jsonResponse(404, { error: "Not found" }));
    }
    return Promise.resolve(jsonResponse(200, { booking: booking(id) }));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function bookingCalls(fetchMock: jest.Mock) {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.startsWith("/api/bookings/"));
}

async function loadedRecipients() {
  const node = await screen.findByTestId("recipients");
  return JSON.parse(node.textContent || "[]") as { bookingId: string }[];
}

beforeEach(() => {
  mockReplaceLocation.mockReset();
  mockSearch = "";
});

describe("normalizeBookingIds", () => {
  it("trims, drops blanks and de-duplicates, keeping first-seen order", () => {
    expect(normalizeBookingIds([" TTH-0002 ", "", "TTH-0001", "TTH-0002", "   "])).toEqual([
      "TTH-0002",
      "TTH-0001"
    ]);
  });

  it("caps the list at 10", () => {
    const ids = Array.from({ length: 14 }, (_, index) => `TTH-${index + 1}`);
    expect(normalizeBookingIds(ids)).toEqual(ids.slice(0, 10));
  });

  it("accepts a single value or nothing", () => {
    expect(normalizeBookingIds("TTH-0001")).toEqual(["TTH-0001"]);
    expect(normalizeBookingIds(undefined)).toEqual([]);
  });
});

describe("<ShippingLabelLoader />", () => {
  it("loads every repeated bookingId once, in order", async () => {
    mockSearch = "bookingId=TTH-0002&bookingId=TTH-0001&bookingId=TTH-0002&bookingId=%20";
    const fetchMock = mockApi();
    render(<ShippingLabelLoader />);

    const recipients = await loadedRecipients();
    expect(recipients).toEqual([
      { name: "Name TTH-0002", phone: "9876543210", address: "Address TTH-0002", bookingId: "TTH-0002" },
      { name: "Name TTH-0001", phone: "9876543210", address: "Address TTH-0001", bookingId: "TTH-0001" }
    ]);
    expect(bookingCalls(fetchMock)).toEqual(["/api/bookings/TTH-0002", "/api/bookings/TTH-0001"]);
  });

  it("loads at most 10 bookings", async () => {
    mockSearch = Array.from({ length: 13 }, (_, index) => `bookingId=TTH-${index + 1}`).join("&");
    const fetchMock = mockApi();
    render(<ShippingLabelLoader />);

    const recipients = await loadedRecipients();
    expect(recipients).toHaveLength(10);
    expect(recipients[9].bookingId).toBe("TTH-10");
    expect(bookingCalls(fetchMock)).toHaveLength(10);
  });

  it("ignores bookings the API cannot find", async () => {
    mockSearch = "bookingId=TTH-0001&bookingId=TTH-9999";
    mockApi({ missing: ["TTH-9999"] });
    render(<ShippingLabelLoader />);

    const recipients = await loadedRecipients();
    expect(recipients.map((recipient) => recipient.bookingId)).toEqual(["TTH-0001"]);
  });

  it("falls back to one empty recipient when nothing was requested or found", async () => {
    const fetchMock = mockApi();
    render(<ShippingLabelLoader />);

    expect(await loadedRecipients()).toEqual([{ name: "", phone: "", address: "", bookingId: "" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/me", expect.anything());
    expect(bookingCalls(fetchMock)).toHaveLength(0);
  });

  it("redirects to the login page when signed out, without mounting the label", async () => {
    mockApi({ meStatus: 401 });
    render(<ShippingLabelLoader />);

    await waitFor(() => expect(mockReplaceLocation).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByTestId("recipients")).not.toBeInTheDocument();
  });
});
