/**
 * The admin area can live on its own host (admin.threadtheoryhome.in) or,
 * when NEXT_PUBLIC_ADMIN_HOST is unset (local dev, previews), under /admin
 * on the same host as the public site.
 */

export function getAdminHost(): string {
  return (process.env.NEXT_PUBLIC_ADMIN_HOST || "").trim().toLowerCase();
}

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Path to an admin page: "/login" on the admin host, "/admin/login" otherwise. */
export function adminPath(path: string = "/"): string {
  if (getAdminHost()) {
    return path;
  }

  return path === "/" ? "/admin" : `/admin${path}`;
}
