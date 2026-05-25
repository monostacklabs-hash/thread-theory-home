import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@/lib/firebase/admin";
import { ADMIN_COOKIE_NAME } from "@/lib/session";

function getAllowedEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return getAllowedEmails().includes(email.toLowerCase());
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);

    if (!isAllowedAdminEmail(decoded.email)) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}
