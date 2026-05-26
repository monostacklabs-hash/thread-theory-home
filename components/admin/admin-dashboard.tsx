"use client";

import { useState } from "react";
import { BookingForm } from "@/components/admin/booking-form";
import { BookingsTable } from "@/components/admin/bookings-table";
import { Modal } from "@/components/admin/modal";
import { BookingRecord } from "@/lib/types";

export function AdminDashboard({ initialBookings }: { initialBookings: BookingRecord[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function handleCreated(booking: BookingRecord, trackingUrl: string) {
    setBookings((current) => [booking, ...current]);
    setFlashMessage(`Tracking link copied for ${booking.bookingId}: ${trackingUrl}`);
    void navigator.clipboard?.writeText(trackingUrl);
    setIsCreateOpen(false);
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
        <span className="badge">{bookings.length} bookings</span>
        <div className="admin-actions-right">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setIsCreateOpen(true)}
          >
            + New booking
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>

      {flashMessage ? (
        <p className="field-help copy-target" role="status" aria-live="polite">
          {flashMessage}
        </p>
      ) : null}

      <BookingsTable
        bookings={bookings}
        onBookingsChange={handleBookingsChange}
        onFlashMessageChange={setFlashMessage}
      />

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create booking"
      >
        <BookingForm onCreated={handleCreated} />
      </Modal>
    </section>
  );
}
