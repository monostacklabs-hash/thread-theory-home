"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { OrderResponse, PublicOrder } from "@/lib/api-types";
import { formatBookingDate, STATUS_LABELS } from "@/lib/bookings";
import { INDIA_POST_TRACK_URL, INSTAGRAM_URL } from "@/lib/constants";
import { BOOKING_TIMELINE, BookingStatus } from "@/lib/types";
import { NotifyCard } from "./notify-card";
import { TrackLink } from "./track-link";
import { TrackingNumberCopy } from "./tracking-number-copy";

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

type LoadState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "loaded"; order: PublicOrder };

export function OrderTrackingLoading() {
  return (
    <section className="tracking-card" aria-busy="true" aria-live="polite">
      <div className="tracking-card-head">
        <span className="eyebrow">Order tracking</span>
      </div>
      <h1>Finding your order…</h1>
      <p>One moment while we look up the latest status.</p>
    </section>
  );
}

function OrderNotFound() {
  return (
    <section className="tracking-card reveal" aria-labelledby="tracking-heading">
      <div className="tracking-card-head">
        <span className="eyebrow">Order tracking</span>
      </div>
      <h1 id="tracking-heading">This tracking link isn’t working.</h1>
      <p>
        The link is invalid or has expired. Please open the most recent tracking link we
        sent you on Instagram, making sure the whole link was copied.
      </p>
      <p>
        <Link className="text-link" href="/tracking-help">
          Tracking help
        </Link>
      </p>
      <p className="tracking-help-line">
        Still stuck? Message us on{" "}
        <Link className="text-link" href={INSTAGRAM_URL}>
          Instagram
        </Link>
      </p>
    </section>
  );
}

function OrderUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="tracking-card reveal" aria-labelledby="tracking-heading" role="alert">
      <div className="tracking-card-head">
        <span className="eyebrow">Order tracking</span>
      </div>
      <h1 id="tracking-heading">Tracking is temporarily unavailable.</h1>
      <p>
        We couldn’t load your order just now. Your order is safe — please check your
        connection and try again in a moment.
      </p>
      <p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      </p>
      <p className="tracking-help-line">
        Need help? Continue the conversation on{" "}
        <Link className="text-link" href={INSTAGRAM_URL}>
          Instagram
        </Link>
      </p>
    </section>
  );
}

export function OrderTracking() {
  const searchParams = useSearchParams();
  const bookingId = (searchParams.get("id") || "").trim();
  const token = (searchParams.get("token") || "").trim();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!bookingId || !token) {
      setState({ kind: "not-found" });
      return;
    }

    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const response = await fetch(
          "/api/orders/" + encodeURIComponent(bookingId) + "?token=" + encodeURIComponent(token),
          { headers: { Accept: "application/json" } }
        );

        if (cancelled) return;

        if (response.status === 404) {
          setState({ kind: "not-found" });
          return;
        }

        if (!response.ok) {
          setState({ kind: "error" });
          return;
        }

        const body = (await response.json()) as OrderResponse;

        if (cancelled) return;

        if (!body?.order) {
          setState({ kind: "error" });
          return;
        }

        setState({ kind: "loaded", order: body.order });
      } catch {
        if (!cancelled) {
          setState({ kind: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingId, token, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  if (state.kind === "loading") {
    return <OrderTrackingLoading />;
  }

  if (state.kind === "not-found") {
    return <OrderNotFound />;
  }

  if (state.kind === "error") {
    return <OrderUnavailable onRetry={retry} />;
  }

  return <OrderDetails order={state.order} token={token} />;
}

function OrderDetails({ order, token }: { order: PublicOrder; token: string }) {
  const isCancelled = order.status === "cancelled";
  const currentStatusIndex = isCancelled
    ? -1
    : (BOOKING_TIMELINE as readonly string[]).indexOf(order.status);

  const headline = HEADLINES[order.status];

  return (
    <>
      <section className="tracking-card reveal" aria-labelledby="tracking-heading">
        <div className="tracking-card-head">
          <span className="eyebrow">Booking · {order.bookingId}</span>
          <span className="status-chip" data-status={order.status} data-readonly="true">
            <span>{STATUS_LABELS[order.status]}</span>
          </span>
        </div>
        <h1 id="tracking-heading">{headline.h1}</h1>
        <p>{headline.sub}</p>
      </section>

      <section className="tracking-grid" aria-label="Order details">
        <article className="tracking-info reveal reveal-delay-1">
          <span className="panel-label">Product</span>
          <h3>{order.product}</h3>
          {order.instagramPostUrl ? (
            <p>
              <a
                className="text-link"
                href={order.instagramPostUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on Instagram
              </a>
            </p>
          ) : null}
          {order.notes ? <p>{order.notes}</p> : null}
          <p className="tracking-meta">Created {formatBookingDate(order.createdAt)}</p>
        </article>

        <article className="tracking-info reveal reveal-delay-2">
          <span className="panel-label">On record for</span>
          <h3>{order.maskedName}</h3>
          <p>{order.maskedPhone}</p>
          {order.maskedEmail ? <p>{order.maskedEmail}</p> : null}
          {order.maskedAddress ? <p>{order.maskedAddress}</p> : null}
        </article>
      </section>

      {order.indiaPostTrackingNumber ? (
        <section
          className="tracking-info reveal reveal-delay-2 tracking-courier"
          aria-label="India Post tracking"
        >
          <span className="panel-label">India Post</span>
          <h3>Tracking number</h3>
          <p className="tracking-courier-row">
            <span className="tracking-number">{order.indiaPostTrackingNumber}</span>
            <TrackingNumberCopy value={order.indiaPostTrackingNumber} />
          </p>
          <p>
            <TrackLink
              trackingNumber={order.indiaPostTrackingNumber}
              href={INDIA_POST_TRACK_URL}
            />
          </p>
        </section>
      ) : null}

      <section className="tracking-info reveal reveal-delay-3" aria-label="Order progress">
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
                <div className={`status-step ${isActive ? "active" : ""}`} key={status}>
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

      <NotifyCard bookingId={order.bookingId} token={token} status={order.status} />

      <p className="tracking-help-line reveal reveal-delay-3">
        Need help? Continue the conversation on{" "}
        <Link className="text-link" href={INSTAGRAM_URL}>
          Instagram
        </Link>
      </p>
    </>
  );
}
