/**
 * Landing page content contract tests.
 * Verifies the static-site-derived layout: hero, gallery, info-grid, founder-note.
 */
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const { fill: _fill, ...rest } = props;
    void _fill;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  }
}));

describe("HomePage — hero", () => {
  it("renders the brand row and kicker", () => {
    render(<HomePage />);
    expect(screen.getByText("Thread Theory", { selector: ".brand-row span" })).toBeInTheDocument();
    expect(screen.getByText(/crafted for comfort/i)).toBeInTheDocument();
  });

  it("renders the h1 headline", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /premium cotton bedsheets for everyday comfort/i
      })
    ).toBeInTheDocument();
  });

  it("renders the intro copy", () => {
    render(<HomePage />);
    expect(
      screen.getByText(/jaipur cotton and other premium cotton qualities/i)
    ).toBeInTheDocument();
  });

  it("renders the Instagram CTA that opens a new tab", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: /visit instagram/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("href", expect.stringContaining("instagram"));
  });

  it("renders 'View collection' anchor link", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: /view collection/i });
    expect(link).toHaveAttribute("href", "#collection");
  });
});

describe("HomePage — Instagram gallery", () => {
  it("renders the collection section anchor", () => {
    render(<HomePage />);
    expect(document.querySelector("#collection")).not.toBeNull();
  });

  it("renders Instagram tiles as outbound links to instagram.com", () => {
    render(<HomePage />);
    const tiles = document.querySelectorAll<HTMLAnchorElement>("a.insta-tile");
    expect(tiles.length).toBeGreaterThan(0);
    tiles.forEach((tile) => {
      expect(tile.getAttribute("href")).toMatch(/instagram\.com\/p\//);
      expect(tile.getAttribute("target")).toBe("_blank");
      expect(tile.getAttribute("rel")).toContain("noreferrer");
    });
  });

  it("labels the large tile as coming from Instagram", () => {
    render(<HomePage />);
    expect(screen.getByText(/from instagram/i)).toBeInTheDocument();
  });
});

describe("HomePage — info grid", () => {
  it("renders the how-it-works anchor", () => {
    render(<HomePage />);
    expect(document.querySelector("#how-it-works")).not.toBeNull();
  });

  it("renders About, Materials, and How to order panels", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /instagram-first business/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /jaipur cotton and premium cotton/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /dm for prices, sizes, and availability/i })
    ).toBeInTheDocument();
  });
});

describe("HomePage — founder note", () => {
  it("renders the founder section with Instagram text link", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /comfort, softness, and simplicity/i })
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /go to @threadtheoryhome\.in/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("instagram"));
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("HomePage — guards", () => {
  it("does NOT contain internal planning copy", () => {
    render(<HomePage />);
    expect(screen.queryByText(/the landing page should feel like fabric/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/this system is intentionally lean/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/the flow is minimal on purpose/i)).not.toBeInTheDocument();
  });

  it("does NOT reference the dropped 'Dune Satin / Ivory Loom / Sage Thread' placeholders", () => {
    render(<HomePage />);
    expect(screen.queryByText("Dune Satin")).not.toBeInTheDocument();
    expect(screen.queryByText("Ivory Loom")).not.toBeInTheDocument();
    expect(screen.queryByText("Sage Thread")).not.toBeInTheDocument();
  });

  it("does NOT render the old static bedroom gallery copy", () => {
    render(<HomePage />);
    expect(screen.queryByText(/soft bedding in calm colours/i)).not.toBeInTheDocument();
  });
});
