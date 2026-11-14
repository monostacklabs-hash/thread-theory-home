import type { NextConfig } from "next";

/**
 * Production builds are a static export (`out/`), served by Cloudflare as
 * static assets; a separate API Worker (worker/) answers /api/*.
 *
 * `next dev` keeps the normal dev server and proxies /api/* to the API Worker
 * running locally with `wrangler dev --port 8787`.
 */
const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = isDevelopment
  ? {
      reactStrictMode: true,
      images: { unoptimized: true },
      async rewrites() {
        return [
          {
            source: "/api/:path*",
            destination: "http://localhost:8787/api/:path*"
          }
        ];
      }
    }
  : {
      reactStrictMode: true,
      output: "export",
      images: { unoptimized: true }
    };

export default nextConfig;
