"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { replaceLocation } from "@/components/admin/navigate";
import type { BookingResponse } from "@/lib/api-types";
import { adminPath } from "@/lib/hosts";
import ShippingLabelClient from "./shipping-label-client";

export const MAX_RECIPIENTS = 10;

type RecipientPrefill = {
  name: string;
  phone: string;
  address: string;
  bookingId: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; recipients: RecipientPrefill[] };

/** Trim, drop blanks, de-duplicate (first occurrence wins) and cap at MAX_RECIPIENTS. */
export function normalizeBookingIds(raw: string | string[] | undefined | null): string[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const trimmed = values.map((value) => value.trim()).filter(Boolean);
  const unique: string[] = [];

  for (const value of trimmed) {
    if (!unique.includes(value)) {
      unique.push(value);
    }
    if (unique.length >= MAX_RECIPIENTS) break;
  }

  return unique;
}

class SignedOutError extends Error {}

async function loadRecipient(bookingId: string): Promise<RecipientPrefill | null> {
  const response = await fetch("/api/bookings/" + encodeURIComponent(bookingId), {
    cache: "no-store"
  });

  if (response.status === 401) {
    throw new SignedOutError();
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Booking ${bookingId} failed to load (${response.status})`);
  }

  const { booking } = (await response.json()) as BookingResponse;

  return {
    name: typeof booking?.name === "string" ? booking.name : "",
    phone: typeof booking?.phone === "string" ? booking.phone : "",
    address: typeof booking?.address === "string" ? booking.address : "",
    bookingId: typeof booking?.bookingId === "string" ? booking.bookingId : bookingId
  };
}

async function checkSignedIn(): Promise<void> {
  const response = await fetch("/api/admin/me", { cache: "no-store" });

  if (response.status === 401) {
    throw new SignedOutError();
  }

  if (!response.ok) {
    throw new Error(`Session check failed (${response.status})`);
  }
}

export function ShippingLabelLoading() {
  return (
    <main className="admin-shell">
      <div className="container">
        <div className="empty-state" aria-busy="true" aria-live="polite">
          <p>Loading shipping label…</p>
        </div>
      </div>
    </main>
  );
}

export function ShippingLabelLoader() {
  const searchParams = useSearchParams();
  // A stable string key, so the effect only re-runs when the ids really change.
  const idsKey = JSON.stringify(normalizeBookingIds(searchParams.getAll("bookingId")));
  const bookingIds = useMemo(() => JSON.parse(idsKey) as string[], [idsKey]);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const [, loaded] = await Promise.all([
          checkSignedIn(),
          Promise.all(bookingIds.map((id) => loadRecipient(id)))
        ]);

        if (cancelled) return;

        const recipients = loaded.filter(
          (entry): entry is RecipientPrefill => entry !== null
        );

        if (recipients.length === 0) {
          recipients.push({ name: "", phone: "", address: "", bookingId: "" });
        }

        setState({ kind: "loaded", recipients });
      } catch (caughtError) {
        if (cancelled) return;

        if (caughtError instanceof SignedOutError) {
          // Stay on the placeholder while the browser moves to the login page.
          replaceLocation(adminPath("/login"));
          return;
        }

        setState({ kind: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingIds, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  if (state.kind === "loading") {
    return <ShippingLabelLoading />;
  }

  if (state.kind === "error") {
    return (
      <main className="admin-shell">
        <div className="container">
          <div className="form-grid">
            <p className="form-error" role="alert">
              The shipping label couldn’t be loaded. Check your connection and try again.
            </p>
            <div>
              <button type="button" className="btn btn-primary" onClick={retry}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ShippingLabelClient copies initialRecipients into state once, so it is only
  // mounted after the data has loaded.
  return <ShippingLabelClient initialRecipients={state.recipients} />;
}
