import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import {
  buildTrackingUrl,
  formatBookingId,
  generateTrackingToken,
  validateCreateBookingInput
} from "@/lib/bookings";
import { getAdminSession } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { BookingRecord, BookingStatus } from "@/lib/types";

export async function POST(request: Request) {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = validateCreateBookingInput(await request.json());
    const db = getAdminDb();

    const result = await db.runTransaction(async (transaction) => {
      const counterRef = db.collection("meta").doc("counters");
      const counterSnapshot = await transaction.get(counterRef);
      const currentCount = counterSnapshot.exists ? counterSnapshot.data()?.bookingCount || 0 : 0;
      const nextCount = currentCount + 1;
      const bookingId = formatBookingId(nextCount);
      const token = generateTrackingToken();
      const bookingRef = db.collection("bookings").doc(bookingId);

      transaction.set(counterRef, { bookingCount: nextCount }, { merge: true });
      transaction.set(bookingRef, {
        bookingId,
        ...payload,
        status: "order_received" satisfies BookingStatus,
        token,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        bookingId,
        token,
        ...payload,
        status: "order_received" as BookingStatus
      };
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const booking: BookingRecord = {
      bookingId: result.bookingId,
      name: result.name,
      phone: result.phone,
      email: result.email,
      address: result.address,
      product: result.product,
      notes: result.notes,
      status: result.status,
      token: result.token,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({
      booking,
      trackingUrl: buildTrackingUrl({
        siteUrl,
        bookingId: result.bookingId,
        token: result.token
      })
    });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Unable to create booking";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
