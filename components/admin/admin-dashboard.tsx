"use client";

import { useState } from "react";
import { BookingForm } from "@/components/admin/booking-form";
import { BookingsTable } from "@/components/admin/bookings-table";
import { BookingRecord } from "@/lib/types";

export function AdminDashboard({ initialBookings }: { initialBookings: BookingRecord[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  function handleCreated(booking: BookingRecord, trackingUrl: string) {
    setBookings((current) => [booking, ...current]);
    setFlashMessage(`Tracking link copied for ${booking.bookingId}: ${trackingUrl}`);
    void navigator.clipboard?.writeText(trackingUrl);
  }

  function handleBookingsChange(nextBookings: BookingRecord[]) {
    setBookings(nextBookings);
  }

  return (
    <section className="admin-grid">
      <div className="admin-panel reveal reveal-delay-1">
        <h2>Create booking</h2>
        <p>Each booking gets a sequential order ID and a secure tokenized tracking link.</p>
        <BookingForm onCreated={handleCreated} />
      </div>

      <div className="admin-panel reveal reveal-delay-2">
        <h2>All bookings</h2>
        <p>Update status as the order moves from confirmation to delivery.</p>
        <BookingsTable
          bookings={bookings}
          onBookingsChange={handleBookingsChange}
          flashMessage={flashMessage}
          onFlashMessageChange={setFlashMessage}
        />
      </div>
    </section>
  );
}
