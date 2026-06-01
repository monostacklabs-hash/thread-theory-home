# Scan-to-fill India Post tracking barcode — design

**Date:** 2026-06-01
**Status:** Approved (pending spec review)

## Problem

When a parcel ships, the admin manually types the India Post Speed Post tracking
number (e.g. `EL779157602IN`) into the booking form. The post office sticker
carries that same number as a printed **Code 128 barcode**. Typing it by hand is
slow and error-prone. We want a "Scan" button that reads the barcode with the
phone camera and fills the field automatically.

## Constraints & context

- Small company, one/two admins. Keep it simple — no overkill.
- Admin panel is used from **both iPhone and Android** phones.
- Existing arch: Next.js 15 App Router, React 19, Firebase, plain CSS design
  system, no UI component library. Admin form is a client component posting to
  API routes (`components/admin/booking-form.tsx`).
- Tracking number is validated server-side against `/^[A-Z]{2}\d{9}IN$/` via
  `normalizeIndiaPostTrackingNumber` in `lib/bookings.ts`.
- `lib/bookings.ts` imports Node `crypto` at the top, so it **cannot** be
  imported into a browser bundle as-is.

## Approach

In-browser camera scan using **`@zxing/browser`** (the 2026 de-facto standard
for 1D barcode scanning), restricted to **Code 128**. Chosen over the native
`BarcodeDetector` API because that API still lacks iOS Safari support in 2026 and
the admin uses both phones — one library gives one reliable code path on both.
Live camera, point-and-scan (no photo-upload flow). Scan fills the field; the
admin reviews and saves as normal (no auto-save).

## Changes

### 1. `lib/india-post.ts` (new, dependency-free)

Extract from `lib/bookings.ts`:

- `INDIA_POST_TRACKING_PATTERN = /^[A-Z]{2}\d{9}IN$/`
- `normalizeIndiaPostTrackingNumber(input)` — trim, uppercase, strip
  whitespace, validate, return normalized value or throw.

`lib/bookings.ts` imports these from the new module instead of declaring them.
Server behaviour is unchanged. The new module has no Node imports, so it is safe
to import from client components.

### 2. `components/admin/barcode-scanner.tsx` (new, client component)

A modal overlay opened on demand. Responsibilities:

- On open, lazily `import("@zxing/browser")` so the decoder loads only when the
  admin taps Scan — the rest of the admin page bundle is unaffected.
- Open the back camera (`facingMode: "environment"`) into a `<video>`
  viewfinder with a simple framing guide. Restrict decoding to `CODE_128`.
- On each successful decode, run the text through
  `normalizeIndiaPostTrackingNumber`:
  - Valid → call `onScanned(value)` and close.
  - Decoded but wrong format (e.g. a stray barcode on the parcel) → keep
    scanning, show a brief "not a tracking number" hint.
- Stop the camera stream and the reader on close/unmount (releases the camera).
- States:
  - Permission denied → "Camera blocked — enable it in browser settings, or
    type the number manually." + Close.
  - No camera found → message + Close.
  - Manual entry in the form remains available in all cases.

Props: `{ onScanned: (value: string) => void; onClose: () => void }`.

### 3. `components/admin/booking-form.tsx` (edit)

- Add a **"Scan"** button beside the India Post tracking input (currently
  lines 192–203). The input stays fully usable for manual typing — scanning is
  additive.
- Tapping Scan opens `<BarcodeScanner>`. A successful scan calls
  `updateField("indiaPostTrackingNumber", value)` and closes the modal.
- No change to submit/Save logic or the API.

### 4. Dependency

Add `@zxing/browser` (pulls `@zxing/library`). Loaded lazily; decoding
restricted to Code 128.

## Testing

Kept lean for a small team:

- Unit tests for `lib/india-post.ts`: valid number, lowercase input, embedded
  whitespace, wrong format, empty/null.
- The camera modal is verified by a real scan test on a phone (hardware can't be
  unit-tested meaningfully). No mocked-camera component test — not worth the
  harness for a one-admin tool.

## Out of scope (YAGNI)

- Photo-upload / gallery decode fallback.
- Batch / multi-parcel scanning.
- India Post API status lookups.
- Scanning any field other than the tracking number.
