import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackLink } from "@/app/order/[bookingId]/track-link";

// jsdom can't follow links; cancel the default so clicking doesn't emit a
// "navigation not implemented" error. The onClick copy logic still runs.
const preventNavigation = (e: Event) => e.preventDefault();

describe("<TrackLink />", () => {
  beforeEach(() => {
    document.addEventListener("click", preventNavigation);
  });
  afterEach(() => {
    document.removeEventListener("click", preventNavigation);
  });

  it("copies the tracking number and shows a confirmation when clicked", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });

    render(
      <TrackLink trackingNumber="EE123456789IN" href="https://www.indiapost.gov.in/" />
    );

    await userEvent.click(
      screen.getByRole("link", { name: /look up at india post/i })
    );

    expect(writeText).toHaveBeenCalledWith("EE123456789IN");
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it("still renders the link when clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true
    });

    render(
      <TrackLink trackingNumber="EE123456789IN" href="https://www.indiapost.gov.in/" />
    );

    const link = screen.getByRole("link", { name: /look up at india post/i });
    await userEvent.click(link);

    expect(link).toHaveAttribute("href", "https://www.indiapost.gov.in/");
    expect(screen.queryByText(/copied/i)).toBeNull();
  });
});
