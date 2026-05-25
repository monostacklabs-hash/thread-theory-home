import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { isBookingStatus } from "@/lib/bookings";
import { BookingRecord } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await params;

  try {
    const body = (await request.json()) as { status?: string; notes?: string };

    if (!body.status || !isBookingStatus(body.status)) {
      return NextResponse.json({ error: "Invalid booking status" }, { status: 400 });
    }

    const bookingRef = getAdminDb().collection("bookings").doc(bookingId);
    await bookingRef.set(
      {
        status: body.status,
        updatedAt: FieldValue.serverTimestamp(),
        ...(typeof body.notes === "string" ? { notes: body.notes.trim() } : {})
      },
      { merge: true }
    );

    const snapshot = await bookingRef.get();
    const data = snapshot.data();

    if (!data) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking: BookingRecord = {
      bookingId: data.bookingId,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      address: data.address,
      product: data.product,
      notes: data.notes || "",
      status: data.status,
      token: data.token,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || undefined,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || undefined
    };

    return NextResponse.json({ booking });
  } catch {
    return NextResponse.json({ error: "Unable to update booking" }, { status: 400 });
  }
}
