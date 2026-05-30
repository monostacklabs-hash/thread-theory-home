import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { PublicFooter } from "@/components/public-footer";
import {
  formatBookingDate,
  maskAddress,
  maskEmail,
  maskName,
  maskPhone,
  STATUS_LABELS
} from "@/lib/bookings";
import { INSTAGRAM_URL } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { BOOKING_TIMELINE, BookingRecord, BookingStatus } from "@/lib/types";
import { TrackingNumberCopy } from "./tracking-number-copy";
import { NotifyCard } from "./notify-card";

export const metadata: Metadata = {
  title: "Order Tracking",
  robots: {
    index: false,
    follow: false
  }
};

const HEADLINES: Record<BookingStatus, { h1: string; sub: string }> = {
  order_received: {
    h1: "We have your order.",
    sub: "Thanks for ordering through Instagram. We’ll confirm shortly and start preparing your bedsheets."
  },
  confirmed: {
    h1: "Your order is confirmed.",
    sub: "We’ve reviewed and accepted the order. Packing is up next."
  },
  preparing: {
    h1: "Your order is being prepared.",
    sub: "Folded, pressed, and getting ready to ship out to you."
  },
  shipped: {
    h1: "Your order is on the way.",
    sub: "The parcel has been handed to the courier and is on its way to your address."
  },
  delivered: {
    h1: "Your order has been delivered.",
    sub: "Thanks for choosing Thread Theory Home. We hope you love your bedsheets."
  },
  cancelled: {
    h1: "This order has been cancelled.",
    sub: "If this looks wrong, please reach out on Instagram and we’ll sort it out."
  }
};

const STEP_COPY: Record<(typeof BOOKING_TIMELINE)[number], string> = {
  order_received: "Your order details were recorded after the Instagram conversation.",
  confirmed: "The order has been reviewed and confirmed by Thread Theory Home.",
  preparing: "The bedsheet set is being prepared for dispatch.",
  shipped: "Your parcel is with the courier and on its way to you.",
  delivered: "The order has been delivered or successfully handed over."
};

const INDIA_POST_TRACK_URL = "https://www.indiapost.gov.in/";

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

  const headline = HEADLINES[booking.status];

  return (
    <div className="page-shell">
      <Nav />
      <main className="tracking-shell">
        <div className="container">
          <section
            className="tracking-card reveal"
            aria-labelledby="tracking-heading"
          >
            <div className="tracking-card-head">
              <span className="eyebrow">Booking · {booking.bookingId}</span>
              <span
                className="status-chip"
                data-status={booking.status}
                data-readonly="true"
              >
                <span>{STATUS_LABELS[booking.status]}</span>
              </span>
            </div>
            <h1 id="tracking-heading">{headline.h1}</h1>
            <p>{headline.sub}</p>
          </section>

          <section className="tracking-grid" aria-label="Order details">
            <article className="tracking-info reveal reveal-delay-1">
              <span className="panel-label">Product</span>
              <h3>{booking.product}</h3>
              {booking.instagramPostUrl ? (
                <p>
                  <a
                    className="text-link"
                    href={booking.instagramPostUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Instagram
                  </a>
                </p>
              ) : null}
              {booking.notes ? <p>{booking.notes}</p> : null}
              <p className="tracking-meta">
                Created {formatBookingDate(booking.createdAt)}
              </p>
            </article>

            <article className="tracking-info reveal reveal-delay-2">
              <span className="panel-label">On record for</span>
              <h3>{maskName(booking.name)}</h3>
              <p>{maskPhone(booking.phone)}</p>
              {booking.email ? <p>{maskEmail(booking.email)}</p> : null}
              {booking.address.trim() ? <p>{maskAddress(booking.address)}</p> : null}
            </article>
          </section>

          {booking.indiaPostTrackingNumber ? (
            <section
              className="tracking-info reveal reveal-delay-2 tracking-courier"
              aria-label="India Post tracking"
            >
              <span className="panel-label">India Post</span>
              <h3>Tracking number</h3>
              <p className="tracking-courier-row">
                <span className="tracking-number">
                  {booking.indiaPostTrackingNumber}
                </span>
                <TrackingNumberCopy value={booking.indiaPostTrackingNumber} />
              </p>
              <p>
                <a
                  className="text-link"
                  href={INDIA_POST_TRACK_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Look up at India Post
                </a>
              </p>
            </section>
          ) : null}

          <section
            className="tracking-info reveal reveal-delay-3"
            aria-label="Order progress"
          >
            <span className="panel-label">Order progress</span>
            <h3>Where your order is</h3>
            {isCancelled ? (
              <p>
                This order has been cancelled. Reach out on Instagram if you have any
                questions.
              </p>
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
                        <p>{STEP_COPY[status]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <NotifyCard
            bookingId={booking.bookingId}
            token={booking.token}
            status={booking.status}
          />

          <p className="tracking-help-line reveal reveal-delay-3">
            Need help? Continue the conversation on{" "}
            <Link className="text-link" href={INSTAGRAM_URL}>
              Instagram
            </Link>
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
