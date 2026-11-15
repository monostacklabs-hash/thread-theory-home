/**
 * Admin pages are built under /admin in the static export. On the admin
 * subdomain the Worker serves them at clean paths.
 */

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** True in a browser that is on the admin subdomain (admin.threadtheoryhome.in). */
function onAdminHost(): boolean {
  return typeof window !== "undefined" && window.location.hostname.startsWith("admin.");
}

/**
 * Path to an admin page. On the admin subdomain the pages are served at clean
 * paths ("/", "/login", "/shipping-label"); anywhere else they are under /admin.
 */
export function adminPath(path: string = "/"): string {
  if (onAdminHost()) return path;
  return path === "/" ? "/admin" : `/admin${path}`;
}
