import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  isBookingStatus,
  normalizeIndiaPostTrackingNumber,
  normalizeInstagramHandle,
  normalizeInstagramPostUrl
} from "@/lib/bookings";
import { BookingRecord } from "@/lib/types";

type PatchBookingBody = {
  status?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  instagramHandle?: string | null;
  address?: string;
  product?: string;
  instagramPostUrl?: string | null;
  indiaPostTrackingNumber?: string | null;
  notes?: string;
};

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
    const body = (await request.json()) as PatchBookingBody;
    const updates: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!isBookingStatus(body.status)) {
        return NextResponse.json({ error: "Invalid booking status" }, { status: 400 });
      }
      updates.status = body.status;
    }

    const requiredText = { name: body.name, phone: body.phone, address: body.address, product: body.product };
    for (const [field, value] of Object.entries(requiredText)) {
      if (value === undefined) continue;
      const trimmed = value.trim();
      if (!trimmed) {
        return NextResponse.json({ error: `${field} cannot be empty` }, { status: 400 });
      }
      updates[field] = trimmed;
    }

    if (body.email !== undefined) {
      updates.email = body.email ? body.email.trim() || null : null;
    }
    if (body.instagramHandle !== undefined) {
      updates.instagramHandle = normalizeInstagramHandle(body.instagramHandle);
    }
    if (body.instagramPostUrl !== undefined) {
      updates.instagramPostUrl = normalizeInstagramPostUrl(body.instagramPostUrl);
    }
    if (body.indiaPostTrackingNumber !== undefined) {
      updates.indiaPostTrackingNumber = normalizeIndiaPostTrackingNumber(
        body.indiaPostTrackingNumber
      );
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.updatedAt = FieldValue.serverTimestamp();
    const bookingRef = getAdminDb().collection("bookings").doc(bookingId);
    await bookingRef.set(updates, { merge: true });

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
      instagramHandle: data.instagramHandle || null,
      address: data.address,
      product: data.product,
      instagramPostUrl: data.instagramPostUrl || null,
      indiaPostTrackingNumber: data.indiaPostTrackingNumber || null,
      notes: data.notes || "",
      status: data.status,
      token: data.token,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || undefined,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || undefined
    };

    return NextResponse.json({ booking });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Unable to update booking";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
