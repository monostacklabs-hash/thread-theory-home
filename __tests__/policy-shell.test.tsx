import { render, screen } from "@testing-library/react";
import { PolicyShell } from "@/components/policy-shell";

const defaultProps = {
  eyebrow: "Test Policy",
  title: "Test Title",
  intro: "Test intro paragraph.",
  children: <p>Test policy content.</p>
};

describe("PolicyShell", () => {
  it("renders the eyebrow label", () => {
    render(<PolicyShell {...defaultProps} />);
    expect(screen.getByText("Test Policy")).toBeInTheDocument();
  });

  it("renders the page title as h1", () => {
    render(<PolicyShell {...defaultProps} />);
    expect(screen.getByRole("heading", { name: "Test Title", level: 1 })).toBeInTheDocument();
  });

  it("renders the intro paragraph", () => {
    render(<PolicyShell {...defaultProps} />);
    expect(screen.getByText("Test intro paragraph.")).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(<PolicyShell {...defaultProps} />);
    expect(screen.getByText("Test policy content.")).toBeInTheDocument();
  });

  it("renders a back link to homepage", () => {
    render(<PolicyShell {...defaultProps} />);
    const backLink = screen.getByRole("link", { name: /back to homepage/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("renders the brand name", () => {
    render(<PolicyShell {...defaultProps} />);
    const instances = screen.getAllByText("Thread Theory Home");
    expect(instances.length).toBeGreaterThanOrEqual(1);
  });

  it("renders main landmark", () => {
    render(<PolicyShell {...defaultProps} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
