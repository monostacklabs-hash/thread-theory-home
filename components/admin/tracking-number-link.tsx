"use client";

import { useEffect, useRef, useState } from "react";
import { INDIA_POST_TRACK_URL } from "@/lib/constants";

type Props = {
  trackingNumber: string;
};

// Admin tracking number: clicking the number opens India Post in a new tab and
// copies the number (India Post has no deep link, so it must be pasted in).
export function TrackingNumberLink({ trackingNumber }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — link still opens */
    }
  }

  return (
    <span className="tracking-value">
      <a
        className="tracking-number tracking-number-link"
        href={INDIA_POST_TRACK_URL}
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
        title="Open India Post and copy this number"
      >
        {trackingNumber}
      </a>
      {copied ? (
        <span className="track-copied-note" role="status">
          Copied
        </span>
      ) : null}
    </span>
  );
}
