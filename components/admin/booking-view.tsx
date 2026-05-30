"use client";

import { ReactNode } from "react";
import { BookingRecord } from "@/lib/types";
import { formatBookingDate, isPrintableStatus, STATUS_LABELS } from "@/lib/bookings";
import { TrackingNumberLink } from "./tracking-number-link";

type BookingViewProps = {
  booking: BookingRecord;
  onEdit: () => void;
  onCopyCustomerLink: () => void;
  onPrintLabel: () => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="booking-card-row">
      <span className="booking-card-label">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Empty() {
  return <span className="booking-view-empty">—</span>;
}

export function BookingView({
  booking,
  onEdit,
  onCopyCustomerLink,
  onPrintLabel
}: BookingViewProps) {
  return (
    <div className="booking-view">
      <Row label="Status">
        <span className="status-chip" data-status={booking.status}>
          <span>{STATUS_LABELS[booking.status]}</span>
        </span>
      </Row>

      <Row label="Instagram">
        {booking.instagramHandle ? (
          <a
            href={`https://ig.me/m/${booking.instagramHandle}`}
            target="_blank"
            rel="noreferrer"
          >
            @{booking.instagramHandle}
          </a>
        ) : (
          <Empty />
        )}
      </Row>

      <Row label="Customer">
        <strong>{booking.name}</strong>
      </Row>

      <Row label="Phone">
        <a href={`tel:${booking.phone}`}>{booking.phone}</a>
      </Row>

      <Row label="Email">
        {booking.email ? (
          <a href={`mailto:${booking.email}`}>{booking.email}</a>
        ) : (
          <Empty />
        )}
      </Row>

      <Row label="Product">{booking.product}</Row>

      <Row label="Post">
        {booking.instagramPostUrl ? (
          <a href={booking.instagramPostUrl} target="_blank" rel="noreferrer">
            View post
          </a>
        ) : (
          <Empty />
        )}
      </Row>

      <Row label="Tracking">
        {booking.indiaPostTrackingNumber ? (
          <TrackingNumberLink trackingNumber={booking.indiaPostTrackingNumber} />
        ) : (
          <Empty />
        )}
      </Row>

      <Row label="Address">
        <span className="booking-view-address">{booking.address}</span>
      </Row>

      <Row label="Notes">
        {booking.notes ? (
          <span className="booking-view-address">{booking.notes}</span>
        ) : (
          <Empty />
        )}
      </Row>

      <Row label="Created">{formatBookingDate(booking.createdAt)}</Row>
      <Row label="Updated">{formatBookingDate(booking.updatedAt)}</Row>

      <div className="view-actions">
        <button
          type="button"
          className="btn btn-ghost btn-compact"
          onClick={onCopyCustomerLink}
        >
          Copy customer link
        </button>
        {isPrintableStatus(booking.status) ? (
          <button
            type="button"
            className="btn btn-ghost btn-compact"
            onClick={onPrintLabel}
          >
            Print shipping label
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-compact"
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
    </div>
  );
}
