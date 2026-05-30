import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { tokenHash } from "@/lib/push";

const MAX_SUBSCRIPTIONS_PER_BOOKING = 10;
const TERMINAL_STATUSES = new Set(["delivered", "cancelled"]);

type Body = {
  urlToken?: string;
  fcmToken?: string;
  userAgent?: string;
};

async function readBooking(bookingId: string) {
  const ref = getAdminDb().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  return { ref, exists: snap.exists, data: snap.data() as { status: string; token: string } | undefined };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const body = (await request.json()) as Body;

  if (!body.urlToken || !body.fcmToken) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { ref, exists, data } = await readBooking(bookingId);
  if (!exists || !data || data.token !== body.urlToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (TERMINAL_STATUSES.has(data.status)) {
    return NextResponse.json({ error: "Order closed" }, { status: 410 });
  }

  const subs = ref.collection("fcmTokens");
  const existing = await subs.get();
  const hash = tokenHash(body.fcmToken);
  const isUpdate = existing.docs.some((d) => d.id === hash);

  if (!isUpdate && existing.size >= MAX_SUBSCRIPTIONS_PER_BOOKING) {
    return NextResponse.json({ error: "Too many devices" }, { status: 429 });
  }

  try {
    await subs.doc(hash).set(
      {
        token: body.fcmToken,
        userAgent: (body.userAgent || "").slice(0, 200),
        createdAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const body = (await request.json()) as Body;

  if (!body.urlToken || !body.fcmToken) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { ref, exists, data } = await readBooking(bookingId);
  if (!exists || !data || data.token !== body.urlToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await ref.collection("fcmTokens").doc(tokenHash(body.fcmToken)).delete();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
