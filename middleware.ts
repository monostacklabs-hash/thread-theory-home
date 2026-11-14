import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminHost, getSiteUrl } from "@/lib/hosts";

const ADMIN_COOKIE_NAME = "tth_admin_session";

// Clean paths served on the admin host, mapped onto the /admin route tree.
const ADMIN_HOST_PAGES = new Set(["/", "/login", "/shipping-label"]);
const NOINDEX = "noindex, nofollow";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function stripAdminPrefix(pathname: string) {
  return pathname.slice("/admin".length) || "/";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  const adminHost = getAdminHost();

  // No dedicated admin host: admin lives under /admin on this host.
  if (!adminHost) {
    if (isAdminPath(pathname) && pathname !== "/admin/login" && !hasSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    return NextResponse.next();
  }

  const host = (request.headers.get("host") || "").toLowerCase();
  const adminOrigin = `${request.nextUrl.protocol}//${adminHost}`;

  if (host !== adminHost) {
    if (isAdminPath(pathname)) {
      return NextResponse.redirect(`${adminOrigin}${stripAdminPrefix(pathname)}${search}`);
    }

    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.next();
  }

  // Admin host from here on.
  if (pathname === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": NOINDEX }
    });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isAdminPath(pathname)) {
    return NextResponse.redirect(`${adminOrigin}${stripAdminPrefix(pathname)}${search}`);
  }

  if (!ADMIN_HOST_PAGES.has(pathname)) {
    return NextResponse.redirect(`${getSiteUrl()}${pathname}${search}`);
  }

  if (pathname !== "/login" && !hasSession) {
    return NextResponse.redirect(`${adminOrigin}/login`);
  }

  const target = request.nextUrl.clone();
  target.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;

  const response = NextResponse.rewrite(target);
  response.headers.set("x-robots-tag", NOINDEX);
  return response;
}

export const config = {
  // Everything except Next internals and files with an extension; robots.txt
  // is listed so the admin host can serve its own.
  matcher: ["/((?!_next/|.*\\..*).*)", "/robots.txt"]
};
