# Admin: tracking display, view modal, shipping label, modal centering

Date: 2026-05-26

## Problem

The admin dashboard order listing is missing three things and has one bug:

1. The India Post tracking number is captured on bookings but never surfaced in the listing, so the team has to open Edit to read it and there is no quick copy.
2. There is no way to view a booking read-only — every "look at this" interaction forces the editable form to open.
3. When a new booking is created (or any time after) there is no way to produce the physical Speed Post shipping label, even though the team has a designed `shipping-label.html` reference at the repo root.
4. The Edit modal does not consistently center on screen — it "pops in somewhere," likely top-anchored, because `.modal-dialog` has no centering rule.

## Goals

- Surface India Post tracking number on order listing (card view + table view), with a one-click copy. Only render when the field is set.
- Add a read-only View modal accessed from the row `⋯` menu, separate from the existing Edit modal.
- Add a "Generate shipping label" row-menu action that opens a print-ready page pre-filled from the booking.
- Fix the Edit/Create modal so it centers vertically and horizontally in the viewport.

## Non-goals

- No schema change to `BookingRecord` (the `indiaPostTrackingNumber` field already exists).
- No new sender-address persistence backend — sender details stay in `localStorage` as in the reference HTML.
- No automatic label generation on booking creation (deliberately kept as an explicit row action so the team controls when it prints).
- No print-from-modal — the label opens in a new tab and uses `window.print()`.

## Design

### 1. India Post tracking on listing

**Card view** — add a new `booking-card-row` after the Phone row, rendered only when `booking.indiaPostTrackingNumber` is truthy:

```
Tracking    EE123456789IN  [copy]
```

The copy icon-button calls `navigator.clipboard.writeText(booking.indiaPostTrackingNumber)` and surfaces success/error through the existing `onFlash` channel.

**Table view** — keep the column structure the same. In the existing Product cell, append a small line below the product name (and below "View post" if present) only when tracking is set:

```
Tracking: EE123456789IN  [copy]
```

This matches the user's pick of "compact, tuck under Product cell" — no new column, no horizontal scroll growth.

Style: reuse `booking-card-label` semantics for the card; for the table use a small `.tracking-inline` class with monospace-ish letterspacing and a tiny ghost copy button (`.tracking-copy`).

### 2. Read-only View modal

**New component:** `components/admin/booking-view.tsx`

Renders booking fields in a read-only definition-list style. Field order matches the form for muscle memory:

- Booking ID + Status
- Customer name
- Phone (tel: link)
- Email (mailto: link if present, else "—")
- Instagram handle (ig.me link if present)
- Address (preformatted)
- Product
- Instagram post URL (link if present)
- India Post tracking number (with copy button)
- Notes
- Created / Updated timestamps

**Footer actions** in the view modal:

- `Copy customer link` — same call as the existing menu item
- `Print shipping label` — opens `/admin/shipping-label?bookingId=…` in a new tab
- `Edit` — closes view modal, opens edit modal with the same booking

**Wiring** in `bookings-table.tsx`:

- Add `viewing: BookingRecord | null` state alongside the existing `editing` state.
- Add a `View booking details` item at the top of the row `⋯` menu (above `Edit`).
- Render a second `<Modal>` for `viewing` analogous to the editing one.

### 3. Shipping label route

**Files:**

- `app/admin/shipping-label/page.tsx` — server component; calls `requireAdminSession()` and reads `bookingId` from `searchParams`. If the booking exists, passes the relevant fields (name, phone, address, bookingId) to a client component. If `bookingId` is missing or unknown, render the client with empty initial values so the page is still usable as a freeform label maker.
- `app/admin/shipping-label/shipping-label-client.tsx` — direct JSX port of `shipping-label.html`'s editor + label + print CSS. Receives initial recipient values via props. Sender (`fromName`, `fromAddr`, `fromPhone`) is persisted in `localStorage` under the same keys as the reference (`tth_label_fromName` etc.) so any prior saves carry over.
- All inline `<style>` from the reference HTML moves into a co-located `app/admin/shipping-label/shipping-label.css` and is imported once from the client component. (The project uses a single global `globals.css`, but importing a sibling CSS file from a client component is supported by Next.js and keeps this large block of label-specific CSS out of `globals.css`.) All inline `<script>` becomes React state + effects.

**Behavioral parity with the reference:**

- Print button calls `window.print()`.
- Order ID prefix `Ref:` and `en-IN` date formatting preserved.
- Cut-mark pseudo-elements + print-only A4 wrapping preserved.
- The "← Back to Admin" link points to `/admin`.

**Row-menu wiring:**

- Add `Generate shipping label` item in `renderRowMenu`. On click: `window.open(\`/admin/shipping-label?bookingId=${booking.bookingId}\`, "_blank", "noopener")`.

### 4. Modal centering fix

Add to `.modal-dialog` in `app/globals.css`:

```css
margin: auto;
inset: 0;
```

Native `<dialog>` UA styles vary — `margin: auto` plus `inset: 0` is the well-known fix that centers the dialog box in the top layer across Chromium, WebKit, and Firefox. The `max-height: calc(100vh - 32px)` already prevents overflow.

## Implementation plan

Two parallel subagents in separate worktrees:

**Agent A — Shipping label route**
- Touches only `app/admin/shipping-label/*`.
- Ports HTML/CSS/JS from `/Users/ak/Documents/work/tth/shipping-label.html` to a Next.js server+client component pair.
- Booking lookup uses the same Firestore pattern as `app/admin/page.tsx`.
- Returns: branch + summary.

**Agent B — Admin dashboard polish**
- Touches `components/admin/bookings-table.tsx`, new `components/admin/booking-view.tsx`, `app/globals.css`.
- Implements tracking display (cards + table), View modal + component, both new row-menu items (the Generate-label item just opens the URL — no coupling to A), modal centering fix.
- Returns: branch + summary.

**Merge order:** A first (purely additive, new route), then B (uses A's URL but no compile-time dependency on A's files).

## Verification

- `npm run build` succeeds.
- Manual: open `/admin`, confirm tracking number is visible + copyable on cards with tracking; confirm same on table.
- Manual: `⋯` menu shows three new items (View, Generate shipping label) without breaking existing items.
- Manual: Edit modal and Create modal both center on viewport; resize window to confirm.
- Manual: Click "Generate shipping label" — new tab opens at `/admin/shipping-label?bookingId=…`, recipient fields pre-fill, "Print Label" opens print preview with A4 label centered.

## Files touched

```
docs/superpowers/specs/2026-05-26-admin-tracking-view-shipping-label-design.md  (this)
app/admin/shipping-label/page.tsx                                                NEW (Agent A)
app/admin/shipping-label/shipping-label-client.tsx                               NEW (Agent A)
app/admin/shipping-label/shipping-label.css                                      NEW (Agent A)
components/admin/booking-view.tsx                                                NEW (Agent B)
components/admin/bookings-table.tsx                                              MOD (Agent B)
app/globals.css                                                                  MOD (Agent B)
```
