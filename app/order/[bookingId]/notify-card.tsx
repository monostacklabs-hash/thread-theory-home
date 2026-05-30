"use client";

import { useEffect, useState } from "react";
import { BookingStatus, TERMINAL_STATUSES } from "@/lib/types";
import { getFirebaseMessaging } from "@/lib/firebase/client";

type Props = {
  bookingId: string;
  token: string;
  status: BookingStatus;
};

type UiState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "ios-hint" }
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "subscribing" }
  | { kind: "success"; fcmToken: string }
  | { kind: "denied" }
  | { kind: "error" };

function detectIosWithoutStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iPhone|iPad|iPod/.test(window.navigator.userAgent);
  if (!isIOS) return false;
  return !window.matchMedia("(display-mode: standalone)").matches;
}

function hasPushSupport(): boolean {
  if (typeof window === "undefined") return false;
  return "PushManager" in window && "serviceWorker" in window.navigator;
}

function storageKey(bookingId: string): string {
  return `tth.notify.${bookingId}`;
}

function readStoredToken(bookingId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(bookingId));
  } catch {
    return null;
  }
}

function writeStoredToken(bookingId: string, fcmToken: string): void {
  try {
    window.localStorage.setItem(storageKey(bookingId), fcmToken);
  } catch {
    /* localStorage unavailable (private mode); UI state still works for this session */
  }
}

function clearStoredToken(bookingId: string): void {
  try {
    window.localStorage.removeItem(storageKey(bookingId));
  } catch {
    /* ignore */
  }
}

export function NotifyCard({ bookingId, token, status }: Props) {
  const [state, setState] = useState<UiState>({ kind: "loading" });

  useEffect(() => {
    if ((TERMINAL_STATUSES as ReadonlyArray<string>).includes(status)) {
      setState({ kind: "unsupported" });
      return;
    }
    if (!hasPushSupport()) {
      setState({ kind: "unsupported" });
      return;
    }
    if (detectIosWithoutStandalone()) {
      setState({ kind: "ios-hint" });
      return;
    }
    const permission = (window as unknown as { Notification?: { permission: NotificationPermission } }).Notification?.permission;
    if (permission === "denied") {
      setState({ kind: "denied" });
      return;
    }
    if (permission === "granted") {
      const storedToken = readStoredToken(bookingId);
      if (storedToken) {
        setState({ kind: "success", fcmToken: storedToken });
        return;
      }
    }
    setState({ kind: "idle" });
  }, [status, bookingId]);

  // Foreground delivery: Firebase suppresses the service worker's
  // onBackgroundMessage whenever any same-origin tab is visible, routing the
  // push to onMessage instead. Without this handler those pushes are dropped.
  useEffect(() => {
    if (state.kind !== "success") return;
    let active = true;
    let unsubscribe = () => {};
    (async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging || !active) return;
      const { onMessage } = await import("firebase/messaging");
      unsubscribe = onMessage(messaging, (payload) => {
        if (!payload.notification) return;
        const { title, body } = payload.notification;
        const link = payload.fcmOptions?.link || "/";
        navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js").then((reg) => {
          reg?.showNotification(title ?? "Order update", {
            body,
            icon: "/icon.svg",
            data: { link }
          });
        });
      });
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [state.kind]);

  async function handleSubscribe() {
    setState({ kind: "requesting" });
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState({ kind: "denied" });
        return;
      }
      if (permission !== "granted") {
        setState({ kind: "idle" });
        return;
      }

      setState({ kind: "subscribing" });
      const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        setState({ kind: "error" });
        return;
      }
      const { getToken } = await import("firebase/messaging");
      const fcmToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: reg
      });
      if (!fcmToken) {
        setState({ kind: "error" });
        return;
      }

      const res = await fetch(`/api/bookings/${bookingId}/subscriptions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          urlToken: token,
          fcmToken,
          userAgent: navigator.userAgent
        })
      });
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      writeStoredToken(bookingId, fcmToken);
      setState({ kind: "success", fcmToken });
    } catch {
      setState({ kind: "error" });
    }
  }

  async function handleUnsubscribe() {
    if (state.kind !== "success") return;
    try {
      const messaging = await getFirebaseMessaging();
      if (messaging) {
        const { deleteToken } = await import("firebase/messaging");
        await deleteToken(messaging);
      }
      const res = await fetch(`/api/bookings/${bookingId}/subscriptions`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urlToken: token, fcmToken: state.fcmToken })
      });
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      clearStoredToken(bookingId);
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "loading" || state.kind === "unsupported") {
    return null;
  }

  if (state.kind === "ios-hint") {
    return (
      <section className="tracking-info notify-card" aria-label="Enable notifications on iPhone">
        <span className="panel-label">Updates</span>
        <h3>Get a ping when this order moves</h3>
        <p>
          On iPhone, tap the <strong>Share</strong> button, then{" "}
          <strong>Add to Home Screen</strong> to enable updates.
        </p>
      </section>
    );
  }

  if (state.kind === "denied") {
    return (
      <section className="tracking-info notify-card" aria-label="Notifications blocked">
        <span className="panel-label">Updates</span>
        <p>Notifications are blocked. Enable them in your browser settings.</p>
      </section>
    );
  }

  if (state.kind === "success") {
    return (
      <section className="tracking-info notify-card" aria-label="Notifications enabled">
        <span className="panel-label">Updates</span>
        <p className="notify-success">✓ You&apos;ll be notified.</p>
        <button type="button" className="text-link notify-stop" onClick={handleUnsubscribe}>
          Stop notifications
        </button>
      </section>
    );
  }

  const busy = state.kind === "requesting" || state.kind === "subscribing";
  const buttonLabel =
    state.kind === "requesting" ? "Asking permission…" : state.kind === "subscribing" ? "Setting up…" : "Notify me";

  return (
    <section className="tracking-info notify-card" aria-label="Enable notifications">
      <span className="panel-label">Updates</span>
      <h3>Get a ping when this order moves</h3>
      <p>We&apos;ll only notify you about this order.</p>
      <button
        type="button"
        className="notify-button"
        onClick={handleSubscribe}
        disabled={busy}
      >
        {buttonLabel}
      </button>
      {state.kind === "error" ? (
        <p className="notify-error">Couldn&apos;t enable notifications. Try again.</p>
      ) : null}
    </section>
  );
}
