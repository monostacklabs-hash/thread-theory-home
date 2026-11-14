import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { PublicFooter } from "@/components/public-footer";
import { INSTAGRAM_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFound() {
  return (
    <div className="page-shell">
      <Nav />
      <main className="tracking-shell">
        <div className="container">
          <section className="tracking-card reveal" aria-labelledby="not-found-heading">
            <div className="tracking-card-head">
              <span className="eyebrow">Page not found</span>
            </div>
            <h1 id="not-found-heading">We couldn’t find that page.</h1>
            <p>
              The link may be mistyped or the page may have moved. If you were looking for
              an order, open the tracking link we sent you on Instagram.
            </p>
            <p>
              <Link className="text-link" href="/">
                Back to Thread Theory Home
              </Link>
            </p>
            <p className="tracking-help-line">
              Need help? Message us on{" "}
              <Link className="text-link" href={INSTAGRAM_URL}>
                Instagram
              </Link>
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
