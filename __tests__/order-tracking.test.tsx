jest.mock("@/lib/firebase/client", () => ({
  getFirebaseMessaging: jest.fn().mockResolvedValue(null)
}));

let mockSearch = "";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch)
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderTracking } from "@/app/order/order-tracking";
import type { PublicOrder } from "@/lib/api-types";

const order: PublicOrder = {
  bookingId: "TTH-0001",
  status: "shipped",
  product: "Ivory Percale Set",
  instagramPostUrl: null,
  notes: "",
  indiaPostTrackingNumber: "EK123456789IN",
  createdAt: "2026-05-01T10:00:00.000Z",
  maskedName: "A*** K***",
  maskedPhone: "******3210",
  maskedEmail: "a***@example.com",
  maskedAddress: "12 *** Kochi"
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  mockSearch = "id=TTH-0001&token=abc%20123";
});

describe("<OrderTracking />", () => {
  it("shows a quiet placeholder while the order loads", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<OrderTracking />);
    expect(screen.getByRole("heading", { name: "Finding your order…" })).toBeInTheDocument();
  });

  it("loads the order with the id and token from the URL and shows masked details", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { order }));
    render(<OrderTracking />);

    expect(
      await screen.findByRole("heading", { name: "Your order is on the way." })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/orders/TTH-0001?token=abc%20123");

    expect(screen.getByText("Booking · TTH-0001")).toBeInTheDocument();
    expect(document.querySelector(".status-chip")).toHaveAttribute("data-status", "shipped");
    expect(document.querySelector(".status-chip")).toHaveTextContent("Shipped");
    expect(screen.getByText("Ivory Percale Set")).toBeInTheDocument();
    expect(screen.getByText("A*** K***")).toBeInTheDocument();
    expect(screen.getByText("******3210")).toBeInTheDocument();
    expect(screen.getByText("a***@example.com")).toBeInTheDocument();
    expect(screen.getByText("12 *** Kochi")).toBeInTheDocument();
    expect(screen.getByText("EK123456789IN")).toBeInTheDocument();
    expect(document.querySelectorAll(".status-step.active")).toHaveLength(4);
  });

  it("leaves out the email and address lines when the API sends null", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        order: { ...order, maskedEmail: null, maskedAddress: null, indiaPostTrackingNumber: null }
      })
    );
    render(<OrderTracking />);

    await screen.findByText("A*** K***");
    expect(screen.queryByText("a***@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("12 *** Kochi")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("India Post tracking")).not.toBeInTheDocument();
  });

  it("shows the invalid-link message when the API answers 404", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Not found" }));
    render(<OrderTracking />);

    expect(
      await screen.findByRole("heading", { name: "This tracking link isn’t working." })
    ).toBeInTheDocument();
    expect(screen.getByText(/invalid or has expired/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tracking help" })).toHaveAttribute(
      "href",
      "/tracking-help"
    );
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      expect.stringContaining("instagram.com")
    );
  });

  it.each([
    ["the id is missing", "token=abc"],
    ["the token is missing", "id=TTH-0001"],
    ["both are missing", ""]
  ])("shows the invalid-link message without calling the API when %s", async (_label, search) => {
    mockSearch = search;
    render(<OrderTracking />);

    expect(
      await screen.findByRole("heading", { name: "This tracking link isn’t working." })
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers a retry after a network error and loads the order on retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { order }));
    render(<OrderTracking />);

    expect(
      await screen.findByRole("heading", { name: "Tracking is temporarily unavailable." })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Your order is on the way." })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a server error as temporarily unavailable, not as an invalid link", async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: "Unavailable" }));
    render(<OrderTracking />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Tracking is temporarily unavailable." })
      ).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
