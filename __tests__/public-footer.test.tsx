import { render, screen } from "@testing-library/react";
import { PublicFooter } from "@/components/public-footer";

describe("PublicFooter", () => {
  it("renders contentinfo role", () => {
    render(<PublicFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("renders brand name", () => {
    render(<PublicFooter />);
    expect(screen.getByText("Thread Theory Home")).toBeInTheDocument();
  });

  it("renders Instagram link in new tab", () => {
    render(<PublicFooter />);
    const link = screen.getByRole("link", { name: /instagram/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("instagram.com"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("renders footer navigation", () => {
    render(<PublicFooter />);
    expect(screen.getByRole("navigation", { name: /footer navigation/i })).toBeInTheDocument();
  });

  it("renders all policy links", () => {
    render(<PublicFooter />);
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tracking Help" })).toBeInTheDocument();
  });

  it("renders current year in copyright", () => {
    render(<PublicFooter />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});
