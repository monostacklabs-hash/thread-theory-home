import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingNumberLink } from "@/components/admin/tracking-number-link";
import { INDIA_POST_TRACK_URL } from "@/lib/constants";

// jsdom can't follow links; cancel default so a click doesn't emit a
// "navigation not implemented" error. The onClick copy logic still runs.
const preventNavigation = (e: Event) => e.preventDefault();

describe("<TrackingNumberLink />", () => {
  beforeEach(() => {
    document.addEventListener("click", preventNavigation);
  });
  afterEach(() => {
    document.removeEventListener("click", preventNavigation);
  });

  it("renders the number as a link to India Post and copies it on click", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });

    render(<TrackingNumberLink trackingNumber="EE123456789IN" />);

    const link = screen.getByRole("link", { name: /EE123456789IN/ });
    expect(link).toHaveAttribute("href", INDIA_POST_TRACK_URL);
    expect(link).toHaveAttribute("target", "_blank");

    await userEvent.click(link);

    expect(writeText).toHaveBeenCalledWith("EE123456789IN");
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });
});
