"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { replaceLocation } from "@/components/admin/navigate";
import { SignOutButton } from "@/components/admin/sign-out-button";
import type { AdminMeResponse, BookingsResponse } from "@/lib/api-types";
import { adminPath } from "@/lib/hosts";
import type { BookingRecord } from "@/lib/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; email: string; bookings: BookingRecord[] };

export function AdminHome() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      try {
        const [meResponse, bookingsResponse] = await Promise.all([
          fetch("/api/admin/me", { cache: "no-store" }),
          fetch("/api/bookings", { cache: "no-store" })
        ]);

        if (cancelled) return;

        if (meResponse.status === 401 || bookingsResponse.status === 401) {
          // Stay on the placeholder while the browser moves to the login page.
          replaceLocation(adminPath("/login"));
          return;
        }

        if (!meResponse.ok || !bookingsResponse.ok) {
          setState({ kind: "error" });
          return;
        }

        const me = (await meResponse.json()) as AdminMeResponse;
        const { bookings } = (await bookingsResponse.json()) as BookingsResponse;

        if (cancelled) return;

        if (typeof me?.email !== "string" || !Array.isArray(bookings)) {
          setState({ kind: "error" });
          return;
        }

        setState({ kind: "loaded", email: me.email, bookings });
      } catch {
        if (!cancelled) {
          setState({ kind: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  const email = state.kind === "loaded" ? state.email : null;

  return (
    <main className="admin-shell">
      <div className="container">
        <section className="admin-header reveal">
          <div className="admin-header-top">
            <div className="admin-identity">
              <span className="eyebrow">Admin</span>
              {email ? <span className="admin-email">{email}</span> : null}
            </div>
            {email ? <SignOutButton /> : null}
          </div>
          <h1>Orders</h1>
          <p>Create a booking after the DM is confirmed, then copy the tracking link to send back on Instagram.</p>
        </section>

        {state.kind === "loading" ? (
          <div className="empty-state" aria-busy="true" aria-live="polite">
            <p>Loading orders…</p>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="form-grid">
            <p className="form-error" role="alert">
              Orders couldn’t be loaded. Check your connection and try again.
            </p>
            <div>
              <button type="button" className="btn btn-primary" onClick={retry}>
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {state.kind === "loaded" ? <AdminDashboard initialBookings={state.bookings} /> : null}
      </div>

      <footer className="admin-foot">
        <div className="container admin-foot-inner">
          <span>Thread Theory · Admin</span>
          {email ? <span>Signed in as {email}</span> : null}
        </div>
      </footer>
    </main>
  );
}
