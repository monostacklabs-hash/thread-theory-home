import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { maskAddress, maskEmail, maskName, maskPhone, STATUS_LABELS } from "@/lib/bookings";
import { INSTAGRAM_URL } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { BOOKING_TIMELINE, BookingRecord } from "@/lib/types";

export const metadata: Metadata = {
  title: "Order Tracking",
  robots: {
    index: false,
    follow: false
  }
};

async function getBooking(bookingId: string): Promise<BookingRecord | null> {
  const snapshot = await getAdminDb().collection("bookings").doc(bookingId).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();

  if (!data) {
    return null;
  }

  return {
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
  } satisfies BookingRecord;
}

export default async function OrderTrackingPage({
  params,
  searchParams
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { bookingId } = await params;
  const { token } = await searchParams;
  const booking = await getBooking(bookingId);

  if (!booking || !token || token !== booking.token) {
    notFound();
  }

  const isCancelled = booking.status === "cancelled";
  const currentStatusIndex = isCancelled
    ? -1
    : (BOOKING_TIMELINE as readonly string[]).indexOf(booking.status);

  return (
    <main className="tracking-shell">
      <div className="container">
        <section className="tracking-card reveal">
          <span className="eyebrow">Order Tracking</span>
          <h1>{booking.bookingId}</h1>
          <p>
            This private page shows the latest status for the order confirmed through Instagram.
          </p>
        </section>

        <section className="tracking-grid section">
          <article className="tracking-info reveal reveal-delay-1">
            <h3>Product details</h3>
            <p>
              <strong>{booking.product}</strong>
            </p>
            {booking.instagramPostUrl ? (
              <p>
                <a
                  className="text-link"
                  href={booking.instagramPostUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Instagram →
                </a>
              </p>
            ) : null}
            <p>{booking.notes || "No extra notes recorded for this order."}</p>
            <p>
              Created{" "}
              {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : "recently"}
            </p>
          </article>

          <article className="tracking-info reveal reveal-delay-2">
            <h3>Customer summary</h3>
            <p>
              <strong>{maskName(booking.name)}</strong>
            </p>
            <p>{maskPhone(booking.phone)}</p>
            <p>{maskEmail(booking.email)}</p>
            <p>{maskAddress(booking.address)}</p>
          </article>
        </section>

        <section className="tracking-info reveal reveal-delay-3">
          <h2>{STATUS_LABELS[booking.status]}</h2>
          {isCancelled ? (
            <p>This order has been cancelled. Reach out on Instagram if you have any questions.</p>
          ) : (
            <div className="status-timeline">
              {BOOKING_TIMELINE.map((status, index) => {
                const isActive = index <= currentStatusIndex;
                return (
                  <div
                    className={`status-step ${isActive ? "active" : ""}`}
                    key={status}
                  >
                      <div className="status-dot" />
                      <div className="status-copy">
                        <strong>{STATUS_LABELS[status]}</strong>
                        <p>
                          {status === "order_received" &&
                            "Your order details were recorded after the Instagram conversation."}
                          {status === "confirmed" &&
                            "The order has been reviewed and confirmed by Thread Theory Home."}
                          {status === "preparing" &&
                            "The bedsheet set is being prepared for dispatch or final handoff."}
                          {status === "delivered" &&
                            "The order has been marked as delivered or successfully handed over."}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        <p className="field-help" style={{ marginTop: 20 }}>
          Need help? Continue the conversation on{" "}
          <Link className="text-link" href={INSTAGRAM_URL}>
            Instagram
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
