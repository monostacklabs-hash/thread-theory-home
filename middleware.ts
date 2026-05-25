import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE_NAME = "tth_admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
