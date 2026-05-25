import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { buildTrackingUrl, generateTrackingToken } from "@/lib/bookings";
import { getAdminSession } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await params;
  const bookingRef = getAdminDb().collection("bookings").doc(bookingId);
  const token = generateTrackingToken();

  await bookingRef.set(
    {
      token,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const snapshot = await bookingRef.get();

  if (!snapshot.exists) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return NextResponse.json({
    bookingId,
    token,
    trackingUrl: buildTrackingUrl({
      siteUrl,
      bookingId,
      token
    })
  });
}
