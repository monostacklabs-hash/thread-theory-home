"use client";

import { useMemo } from "react";
import { BOOKING_STATUSES, BookingRecord, BookingStatus } from "@/lib/types";
import { buildTrackingUrl, STATUS_LABELS } from "@/lib/bookings";

type BookingsTableProps = {
  bookings: BookingRecord[];
  onBookingsChange: (bookings: BookingRecord[]) => void;
  onFlashMessageChange: (message: string | null) => void;
};

export function BookingsTable({
  bookings,
  onBookingsChange,
  onFlashMessageChange
}: BookingsTableProps) {
  const sortedBookings = useMemo(
    () =>
      [...bookings].sort((left, right) =>
        (right.createdAt || "").localeCompare(left.createdAt || "")
      ),
    [bookings]
  );

  async function updateStatus(bookingId: string, status: BookingStatus) {
    onFlashMessageChange(null);

    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    const body = (await response.json()) as { booking?: BookingRecord; error?: string };

    if (!response.ok || !body.booking) {
      onFlashMessageChange(body.error || "Could not update booking");
      return;
    }

    onBookingsChange(
      bookings.map((item) => (item.bookingId === bookingId ? body.booking! : item))
    );
    onFlashMessageChange(`Updated ${bookingId} to ${STATUS_LABELS[status]}`);
  }

  async function copyTrackingLink(booking: BookingRecord) {
    const trackingUrl = buildTrackingUrl({
      siteUrl: window.location.origin,
      bookingId: booking.bookingId,
      token: booking.token
    });

    await navigator.clipboard.writeText(trackingUrl);
    onFlashMessageChange(`Copied tracking link for ${booking.bookingId}`);
  }

  async function regenerateTrackingLink(booking: BookingRecord) {
    onFlashMessageChange(null);

    const response = await fetch(`/api/bookings/${booking.bookingId}/token`, {
      method: "POST"
    });

    const body = (await response.json()) as {
      bookingId?: string;
      token?: string;
      trackingUrl?: string;
      error?: string;
    };

    if (!response.ok || !body.token || !body.trackingUrl) {
      onFlashMessageChange(body.error || "Could not regenerate tracking link");
      return;
    }

    const nextToken = body.token;

    onBookingsChange(
      bookings.map((item) =>
        item.bookingId === booking.bookingId
          ? {
              ...item,
              token: nextToken
            }
          : item
      )
    );
    await navigator.clipboard.writeText(body.trackingUrl);
    onFlashMessageChange(`Regenerated and copied tracking link for ${booking.bookingId}`);
  }

  if (!sortedBookings.length) {
    return (
      <div className="empty-state">
        <p>No bookings yet. Create the first order after an Instagram conversation.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="bookings-cards" aria-label="Bookings">
        {sortedBookings.map((booking) => (
          <li key={booking.bookingId} className="booking-card">
            <div className="booking-card-head">
              <div>
                <div className="booking-id">{booking.bookingId}</div>
                <p className="booking-card-when">
                  {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : "Just now"}
                </p>
              </div>
              <select
                aria-label={`Update status for ${booking.bookingId}`}
                value={booking.status}
                onChange={(event) =>
                  updateStatus(booking.bookingId, event.target.value as BookingStatus)
                }
              >
                {BOOKING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="booking-card-meta">
              {booking.instagramHandle ? (
                <div className="booking-card-row">
                  <span className="booking-card-label">Instagram</span>
                  <a
                    href={`https://ig.me/m/${booking.instagramHandle}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{booking.instagramHandle}
                  </a>
                </div>
              ) : null}
              <div className="booking-card-row">
                <span className="booking-card-label">Customer</span>
                <span>
                  <strong>{booking.name}</strong>
                  {booking.email ? ` · ${booking.email}` : ""}
                </span>
              </div>
              <div className="booking-card-row">
                <span className="booking-card-label">Phone</span>
                <a href={`tel:${booking.phone}`}>{booking.phone}</a>
              </div>
              <div className="booking-card-row">
                <span className="booking-card-label">Product</span>
                <span>
                  {booking.product}
                  {booking.instagramPostUrl ? (
                    <>
                      {" · "}
                      <a
                        href={booking.instagramPostUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View post
                      </a>
                    </>
                  ) : null}
                </span>
              </div>
              {booking.notes ? (
                <div className="booking-card-row">
                  <span className="booking-card-label">Notes</span>
                  <span>{booking.notes}</span>
                </div>
              ) : null}
            </div>

            <div className="booking-card-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => copyTrackingLink(booking)}
              >
                Copy link
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => regenerateTrackingLink(booking)}
              >
                Regenerate
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="bookings-table-shell">
        <table className="bookings-table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {sortedBookings.map((booking) => (
              <tr key={booking.bookingId}>
                <td>
                  <div className="booking-id">{booking.bookingId}</div>
                  <div>
                    <a href={`tel:${booking.phone}`}>{booking.phone}</a>
                  </div>
                </td>
                <td>
                  <strong>{booking.name}</strong>
                  {booking.instagramHandle ? (
                    <p>
                      <a
                        href={`https://ig.me/m/${booking.instagramHandle}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        @{booking.instagramHandle}
                      </a>
                    </p>
                  ) : null}
                  <p>{booking.email || "No email"}</p>
                </td>
                <td>
                  <strong>{booking.product}</strong>
                  {booking.instagramPostUrl ? (
                    <p>
                      <a
                        href={booking.instagramPostUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View post →
                      </a>
                    </p>
                  ) : null}
                  <p>{booking.notes || "No notes"}</p>
                </td>
                <td>
                  <div className="inline-actions">
                    <select
                      aria-label={`Update status for ${booking.bookingId}`}
                      value={booking.status}
                      onChange={(event) =>
                        updateStatus(booking.bookingId, event.target.value as BookingStatus)
                      }
                    >
                      {BOOKING_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => copyTrackingLink(booking)}
                    >
                      Copy link
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => regenerateTrackingLink(booking)}
                    >
                      Regenerate
                    </button>
                  </div>
                </td>
                <td>{booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
