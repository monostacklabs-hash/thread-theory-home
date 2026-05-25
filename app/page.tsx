import Image from "next/image";
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { PublicFooter } from "@/components/public-footer";

export const metadata: Metadata = {
  title: "Thread Theory Home | Premium Bedsheets via Instagram",
  description:
    "Premium cotton bedsheets crafted for everyday comfort. Discover the collection on Instagram and order through DM — no account needed.",
  alternates: { canonical: "/" }
};

export default function HomePage() {
  const instagramUrl =
    process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/threadtheoryhome.in";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Thread Theory Home",
    url: siteUrl,
    sameAs: [instagramUrl],
    description:
      "Premium bedsheet brand selling through Instagram DMs with private order tracking."
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="page-shell landing-shell">
        <Nav />

        <main className="landing-main">
          <div className="container">
            <section className="hero reveal" aria-labelledby="hero-heading">
              <div className="hero-main">
                <div className="brand-row">
                  <Image
                    src="/brand/mark.svg"
                    alt=""
                    width={44}
                    height={22}
                    priority
                  />
                  <span>Thread Theory</span>
                </div>

                <p className="kicker">Crafted for comfort</p>
                <h1 id="hero-heading">Premium cotton bedsheets for everyday comfort.</h1>
                <p className="intro">
                  Soft, well-made bedsheets in Jaipur cotton and other premium cotton qualities.
                  For now, discovery, questions, and ordering happen through Instagram.
                </p>

                <div className="actions">
                  <a
                    className="btn btn-primary"
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit Instagram
                  </a>
                  <a className="btn btn-secondary" href="#collection">
                    View collection
                  </a>
                </div>
              </div>

              <div className="hero-aside">
                <div className="hero-note">
                  <p className="panel-label">What matters here</p>
                  <p>Soft cotton. Clean colours. Everyday ease.</p>
                </div>
                <div
                  className="hero-fabric"
                  role="img"
                  aria-label="Bedroom styled with Thread Theory bedding"
                >
                  <Image
                    src="/photos/bedroom-1.jpg"
                    alt=""
                    fill
                    sizes="(max-width: 960px) 100vw, 40vw"
                    className="hero-fabric-img"
                    priority
                  />
                </div>
              </div>
            </section>

            <section
              className="gallery reveal reveal-delay-1"
              id="collection"
              aria-label="Collection preview"
            >
              <div className="tile tile-large">
                <div className="tile-image">
                  <Image
                    src="/photos/bedroom-2.jpg"
                    alt="Jaipur cotton bedding in soft daylight"
                    fill
                    sizes="(max-width: 720px) 100vw, 55vw"
                    className="tile-image-img"
                  />
                </div>
                <div className="tile-copy">
                  <p className="tile-label">Collection</p>
                  <h2>Soft bedding in calm colours and easy textures.</h2>
                </div>
              </div>

              <div className="tile">
                <div className="tile-image">
                  <Image
                    src="/photos/bedroom-3.jpg"
                    alt="Layered cotton sheets on a styled bed"
                    fill
                    sizes="(max-width: 720px) 100vw, 28vw"
                    className="tile-image-img"
                  />
                </div>
                <div className="mini-caption">Jaipur cotton</div>
              </div>

              <div className="tile">
                <div className="tile-image">
                  <Image
                    src="/photos/bedroom-1.jpg"
                    alt="Bedroom with neatly made bed and warm light"
                    fill
                    sizes="(max-width: 720px) 100vw, 28vw"
                    className="tile-image-img"
                  />
                </div>
                <div className="mini-caption">Premium cotton</div>
              </div>
            </section>

            <section
              className="info-grid reveal reveal-delay-2"
              id="how-it-works"
              aria-label="About, materials, and ordering"
            >
              <article className="panel">
                <p className="panel-label">About</p>
                <h2>Built as an Instagram-first business.</h2>
                <p>This website introduces the brand and leads people back to Instagram.</p>
              </article>

              <article className="panel">
                <p className="panel-label">Materials</p>
                <h2>Jaipur cotton and premium cotton.</h2>
                <p>
                  Breathable, comfortable bedsheets with a soft feel and a clean finish.
                </p>
              </article>

              <article className="panel">
                <p className="panel-label">How to order</p>
                <h2>DM for prices, sizes, and availability.</h2>
                <p>
                  Instagram is currently the easiest place to ask questions and place an order.
                </p>
              </article>
            </section>

            <section className="founder-note reveal reveal-delay-3" aria-label="About Thread Theory">
              <div className="panel">
                <p className="panel-label">About Thread Theory</p>
                <h2>Made for homes that value comfort, softness, and simplicity.</h2>
                <p>
                  Well-made bedding, thoughtful materials, and everyday ease. For now, new
                  pieces, availability, and product questions are handled directly on Instagram.
                </p>
                <a
                  className="text-link"
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Go to @threadtheoryhome.in
                </a>
              </div>
            </section>
          </div>
        </main>

        <PublicFooter />
      </div>
    </>
  );
}
