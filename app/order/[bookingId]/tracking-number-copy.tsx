"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  label?: string;
};

export function TrackingNumberCopy({ value, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <button
      type="button"
      className="copy-link"
      onClick={handleCopy}
      aria-live="polite"
      aria-label={`Copy tracking number ${value}`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
