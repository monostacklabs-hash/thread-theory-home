import crypto from "crypto";
import { BookingStatus, TERMINAL_STATUSES } from "@/lib/types";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/admin";

export const STATUS_NOTIFICATIONS: Partial<Record<BookingStatus, { title: string; body: string }>> = {
  confirmed: { title: "Order confirmed", body: "We've accepted your order. Packing soon." },
  preparing: { title: "Preparing your order", body: "Your bedsheets are being folded and packed." },
  shipped: { title: "On the way", body: "Your parcel is with the courier. Tap to track." },
  delivered: { title: "Delivered", body: "Hope you love your bedsheets. Thanks for choosing us." },
  cancelled: { title: "Order cancelled", body: "Reach out on Instagram if this looks wrong." }
};

export function tokenHash(fcmToken: string): string {
  return crypto.createHash("sha256").update(fcmToken).digest("hex");
}

const PRUNE_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument"
]);

export async function sendStatusPush(args: {
  bookingId: string;
  token: string;
  status: BookingStatus;
}): Promise<void> {
  const notification = STATUS_NOTIFICATIONS[args.status];
  if (!notification) return;

  const db = getAdminDb();
  const subsRef = db.collection("bookings").doc(args.bookingId).collection("fcmTokens");
  const snapshot = await subsRef.get();

  if (snapshot.docs.length === 0) return;

  const tokens = snapshot.docs.map((d) => d.data().token as string);
  const link = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/order/${args.bookingId}?token=${args.token}`;

  try {
    const response = await getAdminMessaging().sendEachForMulticast({
      tokens,
      notification,
      webpush: { fcmOptions: { link } }
    });

    let pruned = 0;
    let failed = 0;
    response.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code;
      if (code && PRUNE_ERROR_CODES.has(code)) {
        void snapshot.docs[i].ref.delete();
        pruned += 1;
      } else {
        failed += 1;
      }
    });

    console.log(
      JSON.stringify({
        event: "push.status_change",
        bookingId: args.bookingId,
        status: args.status,
        tokensFound: tokens.length,
        tokensSent: response.successCount,
        tokensFailed: failed,
        tokensPruned: pruned
      })
    );

    if ((TERMINAL_STATUSES as ReadonlyArray<string>).includes(args.status)) {
      await Promise.all(snapshot.docs.map((d) => d.ref.delete()));
    }
  } catch (caughtError) {
    console.log(
      JSON.stringify({
        event: "push.status_change_error",
        bookingId: args.bookingId,
        status: args.status,
        error: caughtError instanceof Error ? caughtError.message : "unknown"
      })
    );
  }
}
