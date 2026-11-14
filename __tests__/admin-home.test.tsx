const mockReplaceLocation = jest.fn();
jest.mock("@/components/admin/navigate", () => ({
  replaceLocation: (url: string) => mockReplaceLocation(url),
  assignLocation: jest.fn()
}));

jest.mock("@/components/admin/admin-dashboard", () => ({
  AdminDashboard: ({ initialBookings }: { initialBookings: { bookingId: string }[] }) => (
    <ul data-testid="dashboard">
      {initialBookings.map((booking) => (
        <li key={booking.bookingId}>{booking.bookingId}</li>
      ))}
    </ul>
  )
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminHome } from "@/app/admin/admin-home";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

type Routes = Record<string, () => Response | Promise<Response>>;

function mockRoutes(routes: Routes) {
  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const handler = routes[String(input)];
    if (!handler) throw new Error(`Unexpected fetch: ${String(input)}`);
    return Promise.resolve(handler());
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const bookings = [{ bookingId: "TTH-0002" }, { bookingId: "TTH-0001" }];

beforeEach(() => {
  mockReplaceLocation.mockReset();
});

describe("<AdminHome />", () => {
  it("renders the signed-in email and the bookings", async () => {
    const fetchMock = mockRoutes({
      "/api/admin/me": () => jsonResponse(200, { email: "team@example.com" }),
      "/api/bookings": () => jsonResponse(200, { bookings })
    });
    render(<AdminHome />);

    expect(screen.getByText("Loading orders…")).toBeInTheDocument();
    expect(await screen.findByText("team@example.com")).toBeInTheDocument();
    expect(screen.getByText("Signed in as team@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByText("TTH-0002")).toBeInTheDocument();
    expect(screen.getByText("TTH-0001")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockReplaceLocation).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/admin/me", 401, 200],
    ["/api/bookings", 200, 401]
  ])("redirects to the login page when %s answers 401", async (_route, meStatus, bookingsStatus) => {
    mockRoutes({
      "/api/admin/me": () => jsonResponse(meStatus, { email: "team@example.com", error: "x" }),
      "/api/bookings": () => jsonResponse(bookingsStatus, { bookings, error: "x" })
    });
    render(<AdminHome />);

    await waitFor(() => expect(mockReplaceLocation).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an inline error with a retry on a non-401 failure", async () => {
    let bookingsCalls = 0;
    mockRoutes({
      "/api/admin/me": () => jsonResponse(200, { email: "team@example.com" }),
      "/api/bookings": () => {
        bookingsCalls += 1;
        return bookingsCalls === 1
          ? jsonResponse(500, { error: "boom" })
          : jsonResponse(200, { bookings });
      }
    });
    render(<AdminHome />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Orders couldn’t be loaded");
    expect(mockReplaceLocation).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
    expect(screen.getByText("TTH-0002")).toBeInTheDocument();
  });

  it("shows the inline error when the network fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;
    render(<AdminHome />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockReplaceLocation).not.toHaveBeenCalled();
  });
});
