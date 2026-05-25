import Link from "next/link";

const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/threadtheoryhome.in";

export function Nav() {
  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="nav-inner container">
        <Link href="/" className="nav-brand" aria-label="Thread Theory Home">
          <span className="nav-wordmark">Thread Theory</span>
          <span className="nav-home">Home</span>
        </Link>

        <div className="nav-actions">
          <a
            href="#collection"
            className="nav-link"
          >
            Collection
          </a>
          <a
            href="#how-it-works"
            className="nav-link"
          >
            How it works
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary nav-cta"
            aria-label="Message Thread Theory Home on Instagram"
          >
            Message us
          </a>
        </div>
      </div>
    </nav>
  );
}
