"use client";

import { FormEvent, useState } from "react";
import { BookingRecord } from "@/lib/types";

type BookingFormProps = {
  onCreated?: (booking: BookingRecord, trackingUrl: string) => void;
  onUpdated?: (booking: BookingRecord) => void;
  booking?: BookingRecord;
};

const emptyForm = {
  instagramHandle: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  product: "",
  instagramPostUrl: "",
  indiaPostTrackingNumber: "",
  notes: ""
};

function toFormState(booking?: BookingRecord) {
  if (!booking) return emptyForm;
  return {
    instagramHandle: booking.instagramHandle || "",
    name: booking.name,
    phone: booking.phone,
    email: booking.email || "",
    address: booking.address,
    product: booking.product,
    instagramPostUrl: booking.instagramPostUrl || "",
    indiaPostTrackingNumber: booking.indiaPostTrackingNumber || "",
    notes: booking.notes || ""
  };
}

export function BookingForm({ onCreated, onUpdated, booking }: BookingFormProps) {
  const isEditMode = Boolean(booking);
  const [form, setForm] = useState(() => toFormState(booking));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isEditMode && booking) {
        const response = await fetch(`/api/bookings/${booking.bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });

        const body = (await response.json()) as {
          booking?: BookingRecord;
          error?: string;
        };

        if (!response.ok || !body.booking) {
          throw new Error(
            body.error || "Couldn’t save changes. Check the fields and try again."
          );
        }

        onUpdated?.(body.booking);
        return;
      }

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const body = (await response.json()) as {
        booking?: BookingRecord;
        trackingUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.booking || !body.trackingUrl) {
        throw new Error(
          body.error || "Couldn’t create booking. Check the fields and try again."
        );
      }

      setForm(emptyForm);
      onCreated?.(body.booking, body.trackingUrl);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Try again in a moment."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  const submitLabel = isEditMode
    ? isSubmitting
      ? "Saving…"
      : "Save changes"
    : isSubmitting
      ? "Creating…"
      : "Create booking";

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="instagramHandle">Instagram handle (optional)</label>
        <input
          id="instagramHandle"
          value={form.instagramHandle}
          onChange={(event) => updateField("instagramHandle", event.target.value)}
          placeholder="@handle"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="email">Email (optional)</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="product">Product</label>
          <input
            id="product"
            value={form.product}
            onChange={(event) => updateField("product", event.target.value)}
            required
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="instagramPostUrl">Instagram post link (optional)</label>
        <input
          id="instagramPostUrl"
          type="url"
          value={form.instagramPostUrl}
          onChange={(event) => updateField("instagramPostUrl", event.target.value)}
          placeholder="https://www.instagram.com/p/…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className="field">
        <label htmlFor="indiaPostTrackingNumber">India Post tracking number (optional)</label>
        <input
          id="indiaPostTrackingNumber"
          value={form.indiaPostTrackingNumber}
          onChange={(event) => updateField("indiaPostTrackingNumber", event.target.value)}
          placeholder="EE123456789IN"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className="field">
        <label htmlFor="address">Address</label>
        <textarea
          id="address"
          value={form.address}
          onChange={(event) => updateField("address", event.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
        {submitLabel}
      </button>
    </form>
  );
}
