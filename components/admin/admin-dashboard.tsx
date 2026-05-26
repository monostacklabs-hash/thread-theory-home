"use client";

import { useEffect, useState } from "react";
import { BookingForm } from "@/components/admin/booking-form";
import { BookingsTable } from "@/components/admin/bookings-table";
import { Modal } from "@/components/admin/modal";
import { BookingRecord } from "@/lib/types";

type FlashKind = "success" | "error";
type FlashMessage = { text: string; kind: FlashKind } | null;

const FLASH_TIMEOUT_MS = 4200;

function bookingCountLabel(count: number) {
  return count === 1 ? "1 booking" : `${count} bookings`;
}

export function AdminDashboard({ initialBookings }: { initialBookings: BookingRecord[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [flash, setFlash] = useState<FlashMessage>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), FLASH_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [flash]);

  async function handleCreated(booking: BookingRecord, trackingUrl: string) {
    setBookings((current) => [booking, ...current]);
    setIsCreateOpen(false);
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setFlash({
        kind: "success",
        text: `${booking.bookingId} created. Tracking link copied.`
      });
    } catch {
      setFlash({
        kind: "success",
        text: `${booking.bookingId} created. Open the row to copy the tracking link.`
      });
    }
  }

  function handleBookingsChange(nextBookings: BookingRecord[]) {
    setBookings(nextBookings);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <section className="admin-stack reveal reveal-delay-1">
      <div className="admin-actions">
        <span className="badge">{bookingCountLabel(bookings.length)}</span>
        <div className="admin-actions-right">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setIsCreateOpen(true)}
          >
            New booking
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      {flash ? (
        <div
          className={`toast ${flash.kind === "error" ? "toast-error" : ""}`}
          role={flash.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {flash.text}
        </div>
      ) : null}

      <BookingsTable
        bookings={bookings}
        onBookingsChange={handleBookingsChange}
        onFlash={setFlash}
      />

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New booking"
      >
        <BookingForm onCreated={handleCreated} />
      </Modal>
    </section>
  );
}
