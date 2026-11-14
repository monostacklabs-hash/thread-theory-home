/**
 * Admin pages always live under /admin in the static export. On the admin
 * subdomain the Worker handles the host redirects; the paths stay the same.
 */

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Path to an admin page: adminPath("/") → "/admin", adminPath("/login") → "/admin/login". */
export function adminPath(path: string = "/"): string {
  return path === "/" ? "/admin" : `/admin${path}`;
}
