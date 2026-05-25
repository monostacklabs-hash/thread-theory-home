import Link from "next/link";
import { PublicFooter } from "@/components/public-footer";

export function PolicyShell({
  eyebrow,
  title,
  intro,
  children
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="policy-shell">
      <div className="container">
        <header className="policy-header reveal">
          <div className="topbar topbar-policy">
            <div className="brand">
              <span className="brand-mark">Thread Theory Home</span>
            </div>
            <Link className="btn btn-secondary" href="/" aria-label="Back to homepage">
              ← Back
            </Link>
          </div>

          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>

        <section className="policy-content reveal reveal-delay-1" aria-label={title}>
          {children}
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
