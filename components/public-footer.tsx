import Link from "next/link";
import { INSTAGRAM_URL } from "@/lib/constants";

const policyLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/shipping", label: "Shipping & Delivery" },
  { href: "/returns", label: "Returns" },
  { href: "/terms", label: "Terms" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/tracking-help", label: "Tracking Help" }
];

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="public-footer" role="contentinfo">
      <div className="container">
        <div className="public-footer-grid">
          <div className="public-footer-brand">
            <span className="brand-mark">Thread Theory Home</span>
            <p>
              Premium cotton bedsheets ordered through Instagram DM. No account needed —
              just a conversation and a private tracking link.
            </p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="footer-instagram-link"
              aria-label="Follow Thread Theory Home on Instagram"
            >
              @threadtheoryhome.in
            </a>
          </div>

          <nav className="public-footer-links" aria-label="Footer navigation">
            {policyLinks.map((link) => (
              <Link key={link.href} href={link.href} className="footer-link">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="public-footer-bottom">
          <span>© {year} Thread Theory Home. All rights reserved.</span>
          <span>Orders are confirmed manually over Instagram DM. Confirmed orders are final.</span>
        </div>
      </div>
    </footer>
  );
}
