import type { MetadataRoute } from "next";

const staticRoutes = [
  "",
  "/privacy",
  "/shipping",
  "/returns",
  "/terms",
  "/faq",
  "/contact",
  "/tracking-help"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.6
  }));
}
