# Push notifications for customer order tracking

**Date:** 2026-05-30
**Status:** Draft — pending user review
**Owner:** ak

## Summary

Let customers opt in to browser push notifications from their order tracking page (`/order/[bookingId]?token=...`). When admin updates the booking status, subscribed devices receive a push. No customer login. Free of cost. Built on Firebase Cloud Messaging (FCM) because the project already runs on Firebase.

## Goals

- Customer opens the tracking link, clicks "Notify me," gets pushes for every meaningful status change.
- Works on Android Chrome / desktop Chrome / Firefox / Edge / macOS Safari out of the box.
- Works on iPhone Safari only after "Add to Home Screen" (iOS 16.4+ Web Push constraint) — make this explicit to iOS users.
- Zero ongoing cost.
- No new contact channels (Instagram remains the only customer channel for human conversation; push is one-way system notifications only).

## Non-goals

- Email or SMS notifications.
- Customer accounts or preferences (no login by design).
- Broadcast / marketing pushes ("new collection drop"). This system is per-booking-subscription only.
- Unsubscribe inside the notification (browser-level block is sufficient at this scale).
- Notification open-rate analytics.

## Why FCM, not vanilla VAPID Web Push

The project already imports Firebase Admin SDK. Using `firebase-admin/messaging` adds zero new server dependencies and lets the customer-side use `firebase/messaging`. The only cost is ~30 KB of `firebase/messaging` JS added to the tracking page bundle. FCM internally still uses Web Push under the hood — iOS rules and VAPID requirements are identical to the vanilla path.

## Auth model — no login, URL token as bearer credential

The tracking URL contains `?token=<24 random bytes hex>` and this token already gates the SSR tracking page. The same token authorises subscribing a device for push:

- Customer's browser POSTs `{ urlToken, fcmToken }` to `/api/bookings/[bookingId]/subscriptions`.
- Server re-validates `urlToken === booking.token` via Firestore read (same check the SSR page does).
- Anyone with the URL can subscribe. That is the contract — same as Stripe Checkout, delivery tracking links, etc.

This matches industry-standard 2026 patterns for anonymous push subscription. FCM tokens themselves are device-scoped, not user-scoped — they never required login.

## Architecture

### File map

```
app/
  api/bookings/[bookingId]/
    route.ts                          ← existing PATCH, gains sendStatusPush after status write
    subscriptions/route.ts            ← NEW: POST register / DELETE unregister
  order/[bookingId]/
    page.tsx                          ← existing, mounts <NotifyCard /> below the timeline
    notify-card.tsx                   ← NEW: client component, consent UX + getToken flow
lib/
  firebase/client.ts                  ← existing, gains getMessaging() helper
  firebase/admin.ts                   ← existing, gains getAdminMessaging() helper
  push.ts                             ← NEW: sendStatusPush helper + token pruning + STATUS_NOTIFICATIONS map
public/
  firebase-messaging-sw.js            ← NEW: minimal service worker for background pushes
```

### Firestore additions

```
bookings/{bookingId}/fcmTokens/{tokenHash}
  token: string                       // the raw FCM token
  createdAt: Timestamp
  lastSeenAt: Timestamp                // bumped on re-subscribe; used for cleanup
  userAgent: string                    // short, no PII; helps debug iOS vs Android
```

- Subcollection (not top-level) so it dies with its parent booking.
- `tokenHash = sha256(token)` keeps subscribe idempotent across reloads.
- Firestore rules: subcollection is locked down on the client; all reads/writes happen via Admin SDK route handlers.

### Environment variables

- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` — public Web Push certificate from Firebase Console → Project Settings → Cloud Messaging → "Web configuration" → "Generate key pair." Added to Vercel (Production + Preview) and `.env.local`.
- Existing `FIREBASE_SERVICE_ACCOUNT_*` reused for `admin.messaging()`. No new secrets.

### One-time manual setup (cannot be automated from CLI)

1. Firebase Console → Project Settings → Cloud Messaging → Web Push certificate → Generate key pair → copy public key.
2. Confirm Cloud Messaging API is enabled on the underlying GCP project (usually auto).
3. Add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` env var to Vercel (Production + Preview) and `.env.local`.

These three steps are listed as a setup task at the top of the implementation plan.

## Components & UX

### `<NotifyCard bookingId token status />` (client component)

Mounted at the bottom of `app/order/[bookingId]/page.tsx`, above the "Need help?" line. Hidden entirely on terminal status (`delivered` / `cancelled`).

**State machine**

```
load → check Notification.permission

  default              granted                 denied
  Show CTA card        Already subscribed?     Show muted hint:
  "Get a ping when     Yes → "✓ You'll be      "Notifications are
   this order moves."   notified" chip          blocked. Enable in
   [Notify me]          No → re-subscribe       browser settings."
                            silently
```

**CTA card sub-states**

1. **idle** — "Get a ping when this order moves. [Notify me]"
2. **requesting** — button disabled, spinner: "Asking permission…"
3. **subscribing** — "Setting up…" (after permission grant, while POSTing token)
4. **success** — green chip: "✓ You'll be notified" with a small "Stop notifications" text link (triggers unsubscribe flow — see "Unsubscribe" below)
5. **error** — red inline hint: "Couldn't enable notifications. [Try again]"

**iOS hint sub-card** — shown only when `/iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches`. Hides the "Notify me" button entirely:

> "On iPhone, tap the **Share** button, then **Add to Home Screen** to enable updates."

**Feature-detection short-circuit:** if `!('PushManager' in window) || !('serviceWorker' in navigator)`, render nothing.

**Hard rule — never auto-prompt.** The browser permission prompt is only triggered by a user click on "Notify me". Never re-prompt after denial.

### Admin side — no UI change

The existing `PATCH /api/bookings/[bookingId]` route gains a fire-and-forget call to `sendStatusPush` after the Firestore write. No "send notification" button on the bookings table.

### Notification copy (server-defined, in `lib/push.ts`)

```ts
const STATUS_NOTIFICATIONS: Partial<Record<BookingStatus, { title: string; body: string }>> = {
  confirmed: { title: "Order confirmed", body: "We've accepted your order #{bookingId}. Packing soon." },
  preparing: { title: "Preparing your order", body: "Your bedsheets are being folded and packed." },
  shipped:   { title: "On the way", body: "Your parcel is with the courier. Tap to track." },
  delivered: { title: "Delivered", body: "Hope you love your bedsheets. Thanks for choosing us." },
  cancelled: { title: "Order cancelled", body: "Reach out on Instagram if this looks wrong." },
};
```

`order_received` does not fire a notification — by the time the customer can subscribe, they've just received the order. Click action on every notification opens the tracking URL.

**Payload privacy rule:** push payloads must never contain customer name, phone, address, or email. Booking ID only.

## Data flow

### Notification click-through URL

Every push payload sets `webpush.fcmOptions.link = ${NEXT_PUBLIC_SITE_URL}/order/${bookingId}?token=${booking.token}` — the same URL the customer originally clicked. The service worker's `notificationclick` handler opens this URL. Token is required because the SSR tracking page rejects requests without it.

### Subscribe (customer clicks "Notify me")

```
NotifyCard
  └─ Notification.requestPermission()           // user grants
     └─ navigator.serviceWorker.register('/firebase-messaging-sw.js')
        └─ getToken(messaging, { vapidKey, serviceWorkerRegistration })
           └─ POST /api/bookings/[id]/subscriptions  { urlToken, fcmToken, userAgent }
              ├─ server validates urlToken === booking.token
              ├─ server rejects if booking.status in {delivered, cancelled}
              ├─ server rejects if fcmTokens subcollection already has ≥ 10 docs
              └─ server upserts bookings/{id}/fcmTokens/{sha256(fcmToken)}
                 └─ NotifyCard shows "✓ You'll be notified"
```

### Status change → push (admin)

```
PATCH /api/bookings/[id]  { status: "shipped" }
  ├─ existing auth + validation
  ├─ Firestore: bookingRef.set(updates, { merge: true })
  ├─ fire-and-forget: sendStatusPush(bookingId, "shipped")
  │    ├─ read bookings/{id}/fcmTokens (Admin SDK)
  │    ├─ payload from STATUS_NOTIFICATIONS["shipped"]
  │    ├─ admin.messaging().sendEachForMulticast({ tokens, notification, webpush: { fcmOptions: { link } } })
  │    ├─ for each response with code messaging/registration-token-not-registered
  │    │  or messaging/invalid-registration-token → delete that token doc
  │    └─ on terminal status (delivered/cancelled) → after send, delete entire fcmTokens subcollection
  └─ NextResponse 200 (independent of push outcome)
```

### Unsubscribe (customer clicks "Stop notifications")

```
NotifyCard
  └─ deleteToken(messaging)                                          // Firebase SDK invalidates the FCM token
     └─ DELETE /api/bookings/[id]/subscriptions  { urlToken, fcmToken }
        ├─ server validates urlToken === booking.token
        └─ server deletes bookings/{id}/fcmTokens/{sha256(fcmToken)}  // idempotent: 200 even if doc absent
           └─ NotifyCard returns to idle "Get a ping…" state
```

The DELETE endpoint shares the same `urlToken` validation as POST and is idempotent — deleting an absent doc returns 200.

### Background push receipt (customer browser closed)

```
FCM → /firebase-messaging-sw.js (onBackgroundMessage)
  ├─ self.registration.showNotification(title, { body, icon: '/icon.svg', data: { link } })
  └─ notificationclick → clients.openWindow(link)  // tracking URL with token
```

### Token lifecycle

- **Renewal:** Firebase SDK auto-refreshes FCM tokens. Client POSTs the new one on next visit; old token gets pruned naturally on the next send attempt.
- **Multi-device:** Different browsers → different tokens → multiple docs under the same booking. All receive the push.
- **Cleanup on terminal status:** After successful `delivered` or `cancelled` push, the `fcmTokens` subcollection is emptied inline. Volume is low enough that no scheduled cleanup is needed.

## Error handling

### Client (`<NotifyCard>`)

| Failure | Behaviour |
|---|---|
| No `PushManager` / `serviceWorker` support | Render nothing |
| iOS Safari, not standalone | Show iOS hint card, no button |
| Permission denied | "Notifications are blocked. Enable in browser settings." — no retry |
| Permission dismissed | Card returns to idle, wait for next manual click |
| `getToken()` rejects | "Couldn't enable notifications. [Try again]" — one retry |
| POST `/subscriptions` non-2xx | Same retry state |

### Server (`POST /api/bookings/[bookingId]/subscriptions`)

| Failure | Response |
|---|---|
| Missing `urlToken` or `fcmToken` | 400 `{ error: "Missing fields" }` |
| `urlToken !== booking.token` | 404 `{ error: "Not found" }` (same opacity as SSR page) |
| Booking status is `delivered` or `cancelled` | 410 `{ error: "Order closed" }` |
| Firestore write fails | 500 |
| Subcollection size ≥ 10 for this booking | 429 `{ error: "Too many devices" }` |

### Server (`DELETE /api/bookings/[bookingId]/subscriptions`)

| Failure | Response |
|---|---|
| Missing `urlToken` or `fcmToken` | 400 `{ error: "Missing fields" }` |
| `urlToken !== booking.token` | 404 `{ error: "Not found" }` |
| Doc absent | 200 (idempotent) |
| Firestore delete fails | 500 |

### Server (`sendStatusPush`)

- No tokens → silent return.
- FCM throws → caught, logged, PATCH still resolves 200.
- Per-token `messaging/registration-token-not-registered` or `messaging/invalid-argument` → delete that token doc.
- Other per-token errors → leave the doc; log; FCM handles transient retries.
- Partial success is fine.

### Service worker

- Push with no `notification` payload → ignore.
- `clients.openWindow` blocked → fall back to `clients.matchAll().focus()` on a matching open tab.
- SW update → standard `skipWaiting()` + `clients.claim()`.

### Logging

Per-PATCH structured log line: `{ bookingId, status, tokensFound, tokensSent, tokensFailed, tokensPruned }`. No PII. Lets us grep for "why didn't this customer get notified."

## Testing

Scaled to actual risk, not coverage targets. 1 booking/month — we test the surfaces that would silently break, not exhaustive paths.

### Jest unit/integration tests

1. **`POST /api/bookings/[bookingId]/subscriptions`**
   - 404 when `urlToken !== booking.token`
   - 410 on terminal status
   - 429 on cap reached
   - Writes correct doc shape at `bookings/{id}/fcmTokens/{sha256(fcmToken)}`
   - Idempotent: same `fcmToken` POSTed twice yields one doc with updated `lastSeenAt`

2. **`DELETE /api/bookings/[bookingId]/subscriptions`**
   - 404 when `urlToken !== booking.token`
   - 200 when doc exists → doc is deleted
   - 200 when doc absent (idempotent)

3. **`sendStatusPush` in `lib/push.ts`**
   - Zero tokens → resolves with no FCM call
   - Builds correct payload per status from `STATUS_NOTIFICATIONS`
   - Prunes tokens that come back `registration-token-not-registered`
   - Catches FCM throws; never propagates to caller
   - Terminal status → subcollection is empty after send

4. **Existing PATCH handler test** — add one assertion that status change calls `sendStatusPush(bookingId, newStatus)` exactly once.

5. **`<NotifyCard>` render test**
   - Renders nothing when `'serviceWorker' in navigator` is false
   - Renders iOS hint when UA mock matches iPhone
   - Renders idle CTA otherwise

Permission/getToken/fetch wiring is not unit-tested — Firebase SDK plumbing covered by manual verification.

### No test for the service worker

15 lines of Firebase boilerplate; testing in jsdom is more work than reading it.

### Manual verification checklist

- Subscribe on desktop Chrome → PATCH a status → notification appears within ~3s.
- Subscribe on Android Chrome → close browser → PATCH → notification on lock screen.
- Subscribe on second device → PATCH → both devices ping.
- iPhone Safari, not installed → hint card visible, no "Notify me" button.
- iPhone Safari installed as PWA (iOS 16.4+) → subscribe works.
- PATCH to `delivered` → notification fires, `fcmTokens` subcollection is empty after.

Chrome DevTools' Application → Service Workers → Push panel can simulate payloads locally.

## Scale headroom

| Volume | Holds up? | First change needed |
|---|---|---|
| 1–100 bookings/month | Yes | None |
| 1k/month | Yes | Possibly move terminal-status cleanup to a Cloud Function to keep PATCH latency tight |
| 10k/month | Yes | Batch the per-token prune deletes (currently sequential) |
| Broadcast pushes added | N/A | Separate topic-based FCM flow; does not touch this design |

## Out of scope (deliberately deferred)

- Unsubscribe link inside the notification
- Per-customer notification preferences (no login, no identity)
- Email/SMS fallback (IG-only policy)
- Notification analytics
- Re-subscribe across devices via shared account

## Risks

- **iOS reach:** iPhone users who don't install the PWA get nothing. Hint card sets expectations but does not solve.
- **Browser permission denial:** a denied user can never be re-prompted by us — they must re-enable manually in browser settings. Acceptable trade-off for not being a dark-pattern site.
- **FCM availability:** if FCM has an outage during a status change, that push is lost. Not retried. At 1 booking/month, acceptable.

## Open questions

None. All design decisions confirmed during brainstorming.
