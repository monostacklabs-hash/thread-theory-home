"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeIndiaPostTrackingNumber } from "@/lib/india-post";

type BarcodeScannerProps = {
  onScanned: (value: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ onScanned, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Keep the latest onScanned without restarting the camera effect.
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;

  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
        const reader = new BrowserMultiFormatReader(hints);

        if (cancelled || !videoRef.current) return;

        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result) => {
            if (!result) return;
            try {
              const value = normalizeIndiaPostTrackingNumber(result.getText());
              if (value) onScannedRef.current(value);
            } catch {
              setHint("That barcode isn't a tracking number. Keep scanning…");
            }
          }
        );
      } catch (caught) {
        if (cancelled) return;
        const name = caught instanceof Error ? caught.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera blocked. Enable camera access in your browser settings, or type the number manually."
            : name === "NotFoundError"
              ? "No camera found on this device. Type the number manually."
              : "Couldn't start the camera. Try again, or type the number manually."
        );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div
      className="scanner-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Scan tracking barcode"
    >
      <div className="scanner-panel">
        <div className="scanner-head">
          <span>Scan tracking barcode</span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : (
          <>
            <div className="scanner-viewport">
              <video ref={videoRef} className="scanner-video" muted playsInline />
              <div className="scanner-frame" aria-hidden="true" />
            </div>
            <p className="scanner-hint">
              {hint ?? "Point the camera at the barcode on the sticker."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
