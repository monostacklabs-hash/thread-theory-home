import { INSTAGRAM_URL, INSTAGRAM_HANDLE } from "@/lib/constants";

export const dynamic = "force-static";

export function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const body = `# Thread Theory Home

> Premium cotton bedsheets from an India-based, Instagram-first brand. Orders are placed and confirmed through Instagram DM; the website carries brand context, policies, and a private per-order tracking link.

The website does not run a storefront, cart, or customer accounts. Discovery, pricing, sizing, and ordering all happen on Instagram. After an order is confirmed in DM, the customer receives a private tracking URL on this site.

## Brand
- [Homepage](${siteUrl}/): Brand overview and link to Instagram
- [Instagram (@${INSTAGRAM_HANDLE})](${INSTAGRAM_URL}): Sole channel for ordering, product questions, and customer support

## Policies
- [Shipping & Delivery](${siteUrl}/shipping)
- [Returns](${siteUrl}/returns)
- [Privacy Policy](${siteUrl}/privacy)
- [Terms](${siteUrl}/terms)
- [FAQ](${siteUrl}/faq): Common questions about ordering, tracking, and returns
- [Contact](${siteUrl}/contact)
- [Tracking Help](${siteUrl}/tracking-help)
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400"
    }
  });
}
