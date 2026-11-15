"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { adminPath } from "@/lib/hosts";
import { assignLocation } from "./navigate";

// Errors that mean the person closed or cancelled the popup: not worth an error message.
const CANCELLED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setIsSubmitting(true);
    const auth = getFirebaseAuth();

    try {
      const provider = new GoogleAuthProvider();
      // Always show the account chooser, so a second Google account can be picked.
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        // Do not stay signed in to Firebase as an account the site turned away.
        await auth.signOut().catch(() => undefined);
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          response.status === 403
            ? "That Google account is not allowed to manage bookings. Try a different account."
            : body?.error || "That sign-in didn’t go through. Please try again."
        );
      }

      // The admin pages are static files: a full load picks up the new session.
      assignLocation(adminPath("/"));
    } catch (caughtError) {
      const code = (caughtError as { code?: string }).code;
      if (code && CANCELLED.has(code)) {
        // Nothing to show.
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the sign-in window. Allow pop-ups for this site and try again.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This address is not set up for Google sign-in yet.");
      } else {
        setError(
          caughtError instanceof Error && !code
            ? caughtError.message
            : "Sign-in unavailable. Check your connection and try again in a moment."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="form-grid">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="btn btn-primary"
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Waiting for Google…" : "Continue with Google"}
      </button>
    </div>
  );
}
