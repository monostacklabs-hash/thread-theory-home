"use client";

import { ReactNode, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BOOKING_STATUSES, BookingRecord, BookingStatus } from "@/lib/types";
import { buildTrackingUrl, formatBookingDate, STATUS_LABELS } from "@/lib/bookings";
import { Modal } from "@/components/admin/modal";
import { BookingForm } from "@/components/admin/booking-form";
import { BookingView } from "@/components/admin/booking-view";

type FlashKind = "success" | "error";

type FlashMessage = {
  text: string;
  kind: FlashKind;
} | null;

type BookingsTableProps = {
  bookings: BookingRecord[];
  onBookingsChange: (bookings: BookingRecord[]) => void;
  onFlash: (message: FlashMessage) => void;
};

type Confirming =
  | { kind: "regenerate"; booking: BookingRecord }
  | { kind: "cancel"; booking: BookingRecord }
  | null;

type PopoverMenuProps = {
  align?: "start" | "end";
  bookingId: string;
  children: (controls: { close: () => void }) => ReactNode;
  menuClassName?: string;
  trigger: (controls: {
    open: boolean;
    toggle: () => void;
    triggerRef: RefObject<HTMLButtonElement | null>;
  }) => ReactNode;
};

const STATUS_HELP: Record<BookingStatus, string> = {
  order_received: "Order captured and waiting for confirmation.",
  confirmed: "Confirmed with the customer and accepted.",
  preparing: "Being packed or prepared for dispatch.",
  shipped: "Handed to the courier and in transit to the customer.",
  delivered: "Delivered or handed over successfully.",
  cancelled: "Closed and shown as cancelled to the customer."
};

function PopoverMenu({
  align = "end",
  bookingId,
  children,
  menuClassName,
  trigger
}: PopoverMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const triggerNode = triggerRef.current;
      const menuNode = menuRef.current;
      if (!triggerNode || !menuNode) return;

      const triggerRect = triggerNode.getBoundingClientRect();
      const menuRect = menuNode.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 12;
      const desiredLeft =
        align === "start" ? triggerRect.left : triggerRect.right - menuRect.width;
      const maxLeft = window.innerWidth - menuRect.width - viewportPadding;
      const left = Math.max(viewportPadding, Math.min(desiredLeft, maxLeft));
      const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const showAbove = spaceBelow < menuRect.height + gap;
      const top = showAbove
        ? Math.max(viewportPadding, triggerRect.top - menuRect.height - gap)
        : Math.min(
            triggerRect.bottom + gap,
            window.innerHeight - menuRect.height - viewportPadding
          );

      setMenuStyle({ top, left });
    }

    function handlePointer(event: MouseEvent) {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    updatePosition();

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, open]);

  function close() {
    setOpen(false);
  }

  return (
    <div className="row-actions-more" ref={ref}>
      {trigger({ open, toggle: () => setOpen((value) => !value), triggerRef })}
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={menuClassName || "row-actions-menu"}
              role="menu"
              aria-label={`Actions for ${bookingId}`}
              style={
                menuStyle
                  ? {
                      position: "fixed",
                      top: `${menuStyle.top}px`,
                      left: `${menuStyle.left}px`
                    }
                  : { position: "fixed", visibility: "hidden" }
              }
            >
              {children({ close })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function StatusChip({
  booking,
  onChange
}: {
  booking: BookingRecord;
  onChange: (status: BookingStatus) => void;
}) {
  return (
    <PopoverMenu
      align="start"
      bookingId={booking.bookingId}
      menuClassName="row-actions-menu status-menu"
      trigger={({ open, toggle, triggerRef }) => (
        <button
          ref={triggerRef}
          type="button"
          className="status-chip"
          data-status={booking.status}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Change status for ${booking.bookingId}`}
          onClick={toggle}
        >
          <span>{STATUS_LABELS[booking.status]}</span>
        </button>
      )}
    >
      {({ close }) =>
        BOOKING_STATUSES.map((status) => {
          const isActive = booking.status === status;
          return (
            <button
              key={status}
              type="button"
              role="menuitemradio"
              aria-checked={isActive}
              className="row-actions-item status-menu-item"
              data-active={isActive ? "true" : undefined}
              onClick={() => {
                close();
                if (!isActive) {
                  onChange(status);
                }
              }}
            >
              <span>{STATUS_LABELS[status]}</span>
              <small>{isActive ? "Current status" : STATUS_HELP[status]}</small>
            </button>
          );
        })
      }
    </PopoverMenu>
  );
}

export function BookingsTable({
  bookings,
  onBookingsChange,
  onFlash
}: BookingsTableProps) {
  const [editing, setEditing] = useState<BookingRecord | null>(null);
  const [viewing, setViewing] = useState<BookingRecord | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busyAction, setBusyAction] = useState(false);

  const sortedBookings = useMemo(
    () =>
      [...bookings].sort((left, right) => {
        const leftTime = Date.parse(left.updatedAt || left.createdAt || "") || 0;
        const rightTime = Date.parse(right.updatedAt || right.createdAt || "") || 0;
        return rightTime - leftTime;
      }),
    [bookings]
  );

  async function updateStatus(bookingId: string, status: BookingStatus) {
    onFlash(null);

    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    const body = (await response.json()) as { booking?: BookingRecord; error?: string };

    if (!response.ok || !body.booking) {
      onFlash({
        kind: "error",
        text: body.error || `Couldn’t update ${bookingId}. Try again.`
      });
      return;
    }

    onBookingsChange(
      bookings.map((item) => (item.bookingId === bookingId ? body.booking! : item))
    );
    onFlash({ kind: "success", text: `${bookingId} marked ${STATUS_LABELS[status]}.` });
  }

  async function copyTrackingLink(booking: BookingRecord) {
    try {
      const trackingUrl = buildTrackingUrl({
        siteUrl: window.location.origin,
        bookingId: booking.bookingId,
        token: booking.token
      });

      await navigator.clipboard.writeText(trackingUrl);
      onFlash({
        kind: "success",
        text: `Customer tracking page link copied for ${booking.bookingId}.`
      });
    } catch {
      onFlash({
        kind: "error",
        text: "Couldn’t copy to the clipboard. Try again from a secure tab."
      });
    }
  }

  async function copyTrackingNumber(booking: BookingRecord) {
    if (!booking.indiaPostTrackingNumber) return;
    try {
      await navigator.clipboard.writeText(booking.indiaPostTrackingNumber);
      onFlash({
        kind: "success",
        text: `Tracking number copied for ${booking.bookingId}.`
      });
    } catch {
      onFlash({
        kind: "error",
        text: "Couldn’t copy the tracking number. Try again from a secure tab."
      });
    }
  }

  function openShippingLabel(booking: BookingRecord) {
    window.open(
      `/admin/shipping-label?bookingId=${booking.bookingId}`,
      "_blank",
      "noopener"
    );
  }

  async function regenerateTrackingLink(booking: BookingRecord) {
    setBusyAction(true);
    onFlash(null);

    try {
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
        onFlash({
          kind: "error",
          text: body.error || "Couldn’t create a new tracking link. Try again."
        });
        return;
      }

      const nextToken = body.token;

      onBookingsChange(
        bookings.map((item) =>
          item.bookingId === booking.bookingId ? { ...item, token: nextToken } : item
        )
      );

      try {
        await navigator.clipboard.writeText(body.trackingUrl);
        onFlash({
          kind: "success",
          text: `New tracking link copied for ${booking.bookingId}. The old link no longer works.`
        });
      } catch {
        onFlash({
          kind: "success",
          text: `New tracking link created for ${booking.bookingId}. The old link no longer works.`
        });
      }
    } finally {
      setBusyAction(false);
      setConfirming(null);
    }
  }

  async function cancelBooking(booking: BookingRecord) {
    setBusyAction(true);
    try {
      await updateStatus(booking.bookingId, "cancelled");
    } finally {
      setBusyAction(false);
      setConfirming(null);
    }
  }

  function handleUpdated(booking: BookingRecord) {
    onBookingsChange(
      bookings.map((item) => (item.bookingId === booking.bookingId ? booking : item))
    );
    onFlash({ kind: "success", text: `${booking.bookingId} updated.` });
    setEditing(null);
  }

  function renderRowMenu(booking: BookingRecord) {
    const isCancelled = booking.status === "cancelled";
    return (
      <PopoverMenu
        bookingId={booking.bookingId}
        trigger={({ open, toggle, triggerRef }) => (
          <button
            ref={triggerRef}
            type="button"
            className="row-actions-trigger"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`More actions for ${booking.bookingId}`}
            onClick={toggle}
          >
            ⋯
          </button>
        )}
      >
        {({ close }) => (
          <>
            <button
              type="button"
              role="menuitem"
              className="row-actions-item"
              onClick={() => {
                close();
                setViewing(booking);
              }}
            >
              <span>View booking details</span>
              <small>Open a read-only summary of this booking.</small>
            </button>
            <button
              type="button"
              role="menuitem"
              className="row-actions-item"
              onClick={() => {
                close();
                void copyTrackingLink(booking);
              }}
            >
              <span>Copy customer link</span>
              <small>Copies the private tracking page URL to share.</small>
            </button>
            <button
              type="button"
              role="menuitem"
              className="row-actions-item"
              onClick={() => {
                close();
                setEditing(booking);
              }}
            >
              <span>Edit booking details</span>
              <small>Update customer, product, or shipping info.</small>
            </button>
            <button
              type="button"
              role="menuitem"
              className="row-actions-item"
              onClick={() => {
                close();
                openShippingLabel(booking);
              }}
            >
              <span>Generate shipping label</span>
              <small>Opens a printable Speed Post label in a new tab.</small>
            </button>
            <button
              type="button"
              role="menuitem"
              className="row-actions-item"
              onClick={() => {
                close();
                setConfirming({ kind: "regenerate", booking });
              }}
            >
              <span>Replace tracking link</span>
              <small>Creates a new private link and disables the old one.</small>
            </button>
            {!isCancelled ? (
              <>
                <div className="row-actions-divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="row-actions-item row-actions-item-danger"
                  onClick={() => {
                    close();
                    setConfirming({ kind: "cancel", booking });
                  }}
                >
                  <span>Cancel order</span>
                  <small>Shows the order as cancelled on the customer page.</small>
                </button>
              </>
            ) : null}
          </>
        )}
      </PopoverMenu>
    );
  }

  if (!sortedBookings.length) {
    return (
      <div className="empty-state">
        <p>No bookings yet. Start one once a DM is confirmed.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="bookings-cards" aria-label="Bookings">
        {sortedBookings.map((booking) => {
          const isCancelled = booking.status === "cancelled";
          return (
            <li
              key={booking.bookingId}
              className="booking-card"
              data-cancelled={isCancelled ? "true" : undefined}
            >
              <div className="booking-card-head">
                <div>
                  <button
                    type="button"
                    className="booking-id booking-id-button"
                    onClick={() => setViewing(booking)}
                    aria-label={`View details for ${booking.bookingId}`}
                  >
                    {booking.bookingId}
                  </button>
                  <p className="booking-card-when">{formatBookingDate(booking.createdAt)}</p>
                </div>
                <StatusChip
                  booking={booking}
                  onChange={(status) => updateStatus(booking.bookingId, status)}
                />
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
                {booking.indiaPostTrackingNumber ? (
                  <div className="booking-card-row">
                    <span className="booking-card-label">Tracking</span>
                    <span className="tracking-value">
                      <span className="tracking-number">
                        {booking.indiaPostTrackingNumber}
                      </span>
                      <button
                        type="button"
                        className="copy-link"
                        onClick={() => void copyTrackingNumber(booking)}
                        aria-label={`Copy tracking number for ${booking.bookingId}`}
                      >
                        Copy
                      </button>
                    </span>
                  </div>
                ) : null}
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

              <div className="row-actions">
                {renderRowMenu(booking)}
              </div>
            </li>
          );
        })}
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
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {sortedBookings.map((booking) => {
              const isCancelled = booking.status === "cancelled";
              return (
                <tr
                  key={booking.bookingId}
                  data-cancelled={isCancelled ? "true" : undefined}
                >
                  <td>
                    <button
                      type="button"
                      className="booking-id booking-id-button"
                      onClick={() => setViewing(booking)}
                      aria-label={`View details for ${booking.bookingId}`}
                    >
                      {booking.bookingId}
                    </button>
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
                    <p>{booking.email || "—"}</p>
                  </td>
                  <td>
                    <strong>{booking.product}</strong>
                    {booking.instagramPostUrl ? (
                      <p>
                        <a
                          className="text-link"
                          href={booking.instagramPostUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View post
                        </a>
                      </p>
                    ) : null}
                    {booking.indiaPostTrackingNumber ? (
                      <p className="tracking-line">
                        <span className="tracking-eyebrow">Tracking</span>
                        <span className="tracking-number">
                          {booking.indiaPostTrackingNumber}
                        </span>
                        <button
                          type="button"
                          className="copy-link"
                          onClick={() => void copyTrackingNumber(booking)}
                          aria-label={`Copy tracking number for ${booking.bookingId}`}
                        >
                          Copy
                        </button>
                      </p>
                    ) : null}
                    {booking.notes ? <p>{booking.notes}</p> : null}
                  </td>
                  <td>
                    <StatusChip
                      booking={booking}
                      onChange={(status) => updateStatus(booking.bookingId, status)}
                    />
                  </td>
                  <td>{formatBookingDate(booking.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      {renderRowMenu(booking)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? `Booking ${viewing.bookingId}` : "Booking"}
      >
        {viewing ? (
          <BookingView
            booking={viewing}
            onEdit={() => {
              const next = viewing;
              setViewing(null);
              setEditing(next);
            }}
            onCopyCustomerLink={() => void copyTrackingLink(viewing)}
            onPrintLabel={() => openShippingLabel(viewing)}
            onCopyTrackingNumber={
              viewing.indiaPostTrackingNumber
                ? () => void copyTrackingNumber(viewing)
                : undefined
            }
          />
        ) : null}
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.bookingId}` : "Edit booking"}
      >
        {editing ? (
          <BookingForm booking={editing} onUpdated={handleUpdated} />
        ) : null}
      </Modal>

      <Modal
        open={confirming !== null}
        onClose={() => (busyAction ? undefined : setConfirming(null))}
        title={confirming?.kind === "cancel" ? "Cancel this order?" : "Issue a new tracking link?"}
      >
        {confirming ? (
          <div className="confirm-body">
            {confirming.kind === "cancel" ? (
              <p>
                {confirming.booking.bookingId} will be marked cancelled. The customer’s tracking
                page will show the cancelled state. You can move it back to another status at any
                time.
              </p>
            ) : (
              <p>
                A new tracking link will be created for {confirming.booking.bookingId} and copied
                to your clipboard. Send that new link to the customer, because the previously
                shared link will stop working immediately.
              </p>
            )}
            <div className="confirm-actions">
              <button
                className="btn btn-ghost btn-compact"
                type="button"
                onClick={() => setConfirming(null)}
                disabled={busyAction}
              >
                Keep as is
              </button>
              <button
                className="btn btn-danger btn-compact"
                type="button"
                disabled={busyAction}
                onClick={() => {
                  if (confirming.kind === "cancel") {
                    void cancelBooking(confirming.booking);
                  } else {
                    void regenerateTrackingLink(confirming.booking);
                  }
                }}
              >
                {busyAction
                  ? "Working…"
                  : confirming.kind === "cancel"
                    ? "Cancel order"
                    : "Issue new link"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
