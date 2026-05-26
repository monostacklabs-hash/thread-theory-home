import Image from "next/image";
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { PublicFooter } from "@/components/public-footer";
import { INSTAGRAM_URL } from "@/lib/constants";
import instaManifest from "@/data/insta-manifest.json";

type InstaPost = {
  shortcode: string;
  url: string;
  image: string;
  caption: string;
};

const instaPosts: InstaPost[] = instaManifest as InstaPost[];

function firstSentence(caption: string, fallback: string): string {
  if (!caption) return fallback;
  const cleaned = caption.replace(/\s+/g, " ").trim();
  const m = cleaned.match(/^([^.•\n!?]+[.!?]?)/);
  return (m ? m[1] : cleaned).trim() || fallback;
}

export const metadata: Metadata = {
  title: "Thread Theory Home | Premium Bedsheets via Instagram",
  description:
    "Premium cotton bedsheets crafted for everyday comfort. Discover the collection on Instagram and order through DM — no account needed.",
  alternates: { canonical: "/" }
};

export default function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "Thread Theory Home",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    image: `${siteUrl}/photos/bedroom-1.jpg`,
    sameAs: [INSTAGRAM_URL],
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN"
    },
    description:
      "Premium bedsheet brand selling through Instagram DMs with private order tracking."
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: "Thread Theory Home",
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: "en-IN"
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
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
                    href={INSTAGRAM_URL}
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
                <div className="hero-fabric">
                  <Image
                    src="/photos/bedroom-1.jpg"
                    alt="Bedroom styled with Thread Theory Home premium cotton bedsheets"
                    fill
                    sizes="(max-width: 960px) 100vw, 40vw"
                    className="hero-fabric-img"
                    priority
                  />
                </div>
              </div>
            </section>

            {instaPosts.length > 0 && (
              <section
                className="gallery reveal reveal-delay-1"
                id="collection"
                aria-label="From our Instagram"
              >
                <header className="gallery-head">
                  <p className="panel-label">From Instagram</p>
                  <h2 className="gallery-title">Latest from the feed.</h2>
                  <a
                    className="gallery-handle"
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @threadtheoryhome.in
                  </a>
                </header>
                <div className="gallery-grid">
                  {instaPosts.slice(0, 9).map((post) => (
                    <a
                      key={post.shortcode}
                      className="tile insta-tile"
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open Instagram post: ${firstSentence(post.caption, "view on Instagram")}`}
                    >
                      <div className="tile-image">
                        <Image
                          src={post.image}
                          alt={firstSentence(post.caption, "Thread Theory Instagram post")}
                          fill
                          sizes="(max-width: 720px) 100vw, 33vw"
                          className="tile-image-img"
                        />
                        <span className="tile-ig-badge" aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="5" />
                            <circle cx="12" cy="12" r="4" />
                            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                          </svg>
                        </span>
                      </div>
                      <div className="tile-copy">
                        <p className="tile-eyebrow">Instagram</p>
                        <p className="tile-caption">
                          {firstSentence(post.caption, "View post")}
                        </p>
                        <span className="insta-link-hint">View post →</span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

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
                  href={INSTAGRAM_URL}
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
