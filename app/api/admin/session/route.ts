import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAllowedAdminEmail } from "@/lib/auth";
import { getAdminAuth } from "@/lib/firebase/admin";
import { ADMIN_COOKIE_NAME } from "@/lib/session";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };

    if (!body.idToken) {
      return NextResponse.json({ error: "Missing ID token" }, { status: 400 });
    }

    const decoded = await getAdminAuth().verifyIdToken(body.idToken);

    if (!isAllowedAdminEmail(decoded.email)) {
      return NextResponse.json({ error: "This account is not allowed" }, { status: 403 });
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(body.idToken, {
      expiresIn: SESSION_DURATION_MS
    });

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin/session failed", error);
    return NextResponse.json({ error: "Could not create admin session" }, { status: 401 });
  }
}
