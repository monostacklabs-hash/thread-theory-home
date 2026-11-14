"use client";

import { useState } from "react";
import { adminPath } from "@/lib/hosts";

export function SignOutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = adminPath("/login");
  }

  return (
    <button
      type="button"
      className="admin-signout"
      onClick={handleLogout}
      disabled={isLoggingOut}
    >
      {isLoggingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
