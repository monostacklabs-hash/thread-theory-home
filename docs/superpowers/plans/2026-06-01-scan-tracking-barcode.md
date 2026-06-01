# Scan-to-fill Tracking Barcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin fill the India Post tracking field by scanning the parcel's Code 128 barcode with the phone camera, instead of typing it.

**Architecture:** Extract the existing tracking-number validation into a browser-safe module. Add a lazy-loaded camera modal component using `@zxing/browser` (restricted to Code 128) that decodes the barcode, validates it with the shared module, and reports the value up. Wire a "Scan" button next to the existing tracking input in the admin booking form; a successful scan fills the field and the admin saves as normal.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, `@zxing/browser`, Jest + Testing Library, plain CSS design system.

---

## File Structure

- **Create** `lib/india-post.ts` — dependency-free tracking-number pattern + `normalizeIndiaPostTrackingNumber`. Importable from both server and client.
- **Modify** `lib/bookings.ts` — import the pattern/normalizer from `lib/india-post.ts` instead of declaring them; re-export `normalizeIndiaPostTrackingNumber` to preserve existing import paths.
- **Create** `__tests__/india-post.test.ts` — unit tests for the normalizer.
- **Create** `components/admin/barcode-scanner.tsx` — client camera modal (`@zxing/browser`, Code 128, lazy import, camera cleanup, permission/no-camera fallbacks).
- **Modify** `components/admin/booking-form.tsx` — add a "Scan" button beside the tracking input and render the scanner modal.
- **Modify** `app/globals.css` — styles for the scanner overlay and the input+button row.
- **Modify** `package.json` / `package-lock.json` — add `@zxing/browser`.

---

## Task 1: Extract tracking validation into a browser-safe module

**Files:**
- Create: `lib/india-post.ts`
- Create: `__tests__/india-post.test.ts`
- Modify: `lib/bookings.ts:36` (remove local pattern), `lib/bookings.ts:58-66` (remove local function), add import + re-export near top

- [ ] **Step 1: Write the failing test**

Create `__tests__/india-post.test.ts`:

```ts
import { normalizeIndiaPostTrackingNumber } from "@/lib/india-post";

describe("normalizeIndiaPostTrackingNumber", () => {
  it("accepts a valid number unchanged", () => {
    expect(normalizeIndiaPostTrackingNumber("EE123456789IN")).toBe("EE123456789IN");
  });

  it("uppercases and strips internal/edge whitespace", () => {
    expect(normalizeIndiaPostTrackingNumber(" el 779157602 in ")).toBe("EL779157602IN");
  });

  it("returns null for empty or nullish input", () => {
    expect(normalizeIndiaPostTrackingNumber("")).toBeNull();
    expect(normalizeIndiaPostTrackingNumber(null)).toBeNull();
    expect(normalizeIndiaPostTrackingNumber(undefined)).toBeNull();
  });

  it("throws on the wrong format", () => {
    expect(() => normalizeIndiaPostTrackingNumber("12345")).toThrow();
    expect(() => normalizeIndiaPostTrackingNumber("EEE12345678IN")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/india-post.test.ts`
Expected: FAIL — cannot find module `@/lib/india-post`.

- [ ] **Step 3: Create the module**

Create `lib/india-post.ts` (no Node imports — safe for the browser bundle):

```ts
export const INDIA_POST_TRACKING_PATTERN = /^[A-Z]{2}\d{9}IN$/;

export function normalizeIndiaPostTrackingNumber(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  if (!INDIA_POST_TRACKING_PATTERN.test(cleaned)) {
    throw new Error("Invalid India Post tracking number (expected format: EE123456789IN)");
  }
  return cleaned;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/india-post.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Point `lib/bookings.ts` at the new module**

In `lib/bookings.ts`:

1. Delete the local constant on line 36:
   `const INDIA_POST_TRACKING_PATTERN = /^[A-Z]{2}\d{9}IN$/;`
2. Delete the entire local `normalizeIndiaPostTrackingNumber` function (lines 58–66).
3. Add near the top of the file, just below the existing imports:

```ts
import { normalizeIndiaPostTrackingNumber } from "@/lib/india-post";

export { normalizeIndiaPostTrackingNumber };
```

(The `import` provides the binding used internally at the `createBookingRecord` call site; the `export` re-exposes it so any module importing it from `@/lib/bookings` keeps working. Leave the `INSTAGRAM_*` patterns and their normalizers untouched.)

- [ ] **Step 6: Verify nothing else broke**

Run: `npx tsc --noEmit && npx jest`
Expected: typecheck clean; full suite PASS (including the existing booking/API tests that call `normalizeIndiaPostTrackingNumber`).

- [ ] **Step 7: Commit**

```bash
git add lib/india-post.ts __tests__/india-post.test.ts lib/bookings.ts
git commit -m "Extract India Post tracking validation into browser-safe module"
```

---

## Task 2: Add the `@zxing/browser` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install @zxing/browser`
Expected: adds `@zxing/browser` (and its peer `@zxing/library`) to `dependencies`.

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require('@zxing/browser'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add @zxing/browser for barcode scanning"
```

---

## Task 3: Build the barcode scanner modal component

> No automated test for this task: it drives the device camera, which can't be meaningfully unit-tested. The decode-acceptance logic it relies on (`normalizeIndiaPostTrackingNumber`) is already covered by Task 1. Verified by a real phone scan in Task 5.

**Files:**
- Create: `components/admin/barcode-scanner.tsx`
- Modify: `app/globals.css` (append scanner overlay styles)

- [ ] **Step 1: Create the component**

Create `components/admin/barcode-scanner.tsx`:

```tsx
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
              setHint("That barcode isn’t a tracking number. Keep scanning…");
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
              : "Couldn’t start the camera. Try again, or type the number manually."
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
```

- [ ] **Step 2: Append the styles**

Add to the end of `app/globals.css`:

```css
/* ── Barcode scanner modal ───────────────────────────────── */

.scanner-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(20, 16, 12, 0.72);
  backdrop-filter: blur(8px);
}

.scanner-panel {
  width: min(420px, 100%);
  background: #fffaf2;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 24px 60px rgba(29, 39, 64, 0.28);
}

.scanner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 600;
}

.scanner-viewport {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
}

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-frame {
  position: absolute;
  inset: 18% 10%;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 10px;
}

.scanner-hint {
  margin: 10px 2px 2px;
  font-size: 0.85rem;
  color: var(--ink-soft);
  text-align: center;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no type errors in the new component).

- [ ] **Step 4: Commit**

```bash
git add components/admin/barcode-scanner.tsx app/globals.css
git commit -m "Add Code 128 barcode scanner modal for tracking numbers"
```

---

## Task 4: Wire the Scan button into the booking form

**Files:**
- Modify: `components/admin/booking-form.tsx` (import, state, tracking field at lines 192–203, render modal)
- Modify: `app/globals.css` (append input+button row style)

- [ ] **Step 1: Add the import and state**

In `components/admin/booking-form.tsx`:

1. Add to the imports at the top:

```tsx
import { BarcodeScanner } from "@/components/admin/barcode-scanner";
```

2. Add alongside the other `useState` hooks inside `BookingForm` (next to `isSubmitting`):

```tsx
const [scanning, setScanning] = useState(false);
```

- [ ] **Step 2: Replace the tracking field block**

Replace the existing tracking-number field (currently lines 192–203) with:

```tsx
      <div className="field">
        <label htmlFor="indiaPostTrackingNumber">India Post tracking number (optional)</label>
        <div className="input-with-action">
          <input
            id="indiaPostTrackingNumber"
            value={form.indiaPostTrackingNumber}
            onChange={(event) => updateField("indiaPostTrackingNumber", event.target.value)}
            placeholder="EE123456789IN"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setScanning(true)}
          >
            Scan
          </button>
        </div>
      </div>
```

- [ ] **Step 3: Render the modal**

Add directly below the `{error ? (...) : null}` block, just before the submit `<button>`:

```tsx
      {scanning ? (
        <BarcodeScanner
          onScanned={(value) => {
            updateField("indiaPostTrackingNumber", value);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      ) : null}
```

- [ ] **Step 4: Append the input-row style**

Add to the end of `app/globals.css`:

```css
.input-with-action {
  display: flex;
  gap: 8px;
}

.input-with-action input {
  flex: 1;
  min-width: 0;
}

.input-with-action .btn {
  flex: 0 0 auto;
  padding-inline: 16px;
}
```

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: typecheck clean; all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin/booking-form.tsx app/globals.css
git commit -m "Add Scan button to fill tracking number from barcode"
```

---

## Task 5: Manual verification on a phone

**Files:** none (verification only)

- [ ] **Step 1: Run the app and reach the admin form**

Run: `npm run dev`
Open the admin page on a phone (or a laptop with a webcam) over `https`/localhost — `getUserMedia` requires a secure context. Open the new-booking or edit-booking form.

- [ ] **Step 2: Scan a real sticker**

Tap **Scan**. Grant camera permission. Point at an India Post Speed Post barcode (e.g. `EL779157602IN`).
Expected: the modal closes and the tracking field is filled with the normalized number.

- [ ] **Step 3: Check the fallbacks**

- Deny camera permission once → expect the "Camera blocked…" message with a Close button, and the field still typeable.
- Point at a non-tracking barcode → expect the "isn’t a tracking number" hint while the camera keeps scanning.

- [ ] **Step 4: Save and confirm persistence**

Save the booking. Confirm the scanned number persists and renders (it passes the same server validation as a typed number).

- [ ] **Step 5: Final typecheck/test gate before handoff**

Run: `npx tsc --noEmit && npx jest`
Expected: clean + all green.

---

## Notes for the implementer

- **Secure context required:** the camera only works on `localhost` or `https`. Testing over a plain-IP `http` LAN address will fail with a permission/security error — that's expected, not a bug.
- **Don't auto-save on scan:** scanning only fills the field. The admin reviews and presses Save, exactly as with manual entry.
- **Code 128 only:** the format is restricted on purpose so the reader locks on fast and ignores other marks on the parcel. Don't widen `POSSIBLE_FORMATS` unless a real sticker uses a different symbology.
