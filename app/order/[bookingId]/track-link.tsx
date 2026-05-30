"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  trackingNumber: string;
  href: string;
};

export function TrackLink({ trackingNumber, href }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Best-effort copy on the way out — India Post has no deep link, so the
  // customer must paste the number into its form. Never block navigation.
  async function handleClick() {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 4000);
    } catch {
      /* clipboard unavailable — link still opens */
    }
  }

  return (
    <>
      <a
        className="text-link"
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
      >
        Look up at India Post
      </a>
      {copied ? (
        <span className="track-copied-note" role="status">
          Copied — paste it on the India Post page
        </span>
      ) : null}
    </>
  );
}
