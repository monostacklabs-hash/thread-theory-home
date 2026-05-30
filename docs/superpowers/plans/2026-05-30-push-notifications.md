# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers opt in to browser push notifications from their order tracking page; deliver a push on every meaningful status change. Anonymous (no login), URL-token-gated, free of cost via Firebase Cloud Messaging.

**Architecture:** New POST/DELETE subscription endpoint registers anonymous FCM tokens under `bookings/{id}/fcmTokens/{sha256(token)}`. The existing PATCH route gains a fire-and-forget call to `sendStatusPush` that reads the subcollection and multicasts a notification. A small client component on the tracking page handles permission + token registration. A 15-line service worker handles background pushes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Firebase JS SDK (`firebase/messaging`) on the client, Firebase Admin SDK (`firebase-admin/messaging`) on the server, Jest + Testing Library for tests. No new npm dependencies — `firebase ^11.6.0` and `firebase-admin ^13.1.0` already in package.json.

**Branch:** `feat/push-notifications` (already created and contains the spec commit).

**Spec:** `docs/superpowers/specs/2026-05-30-push-notifications-design.md`

---

## Task 0: One-time manual setup (human, not coded)

**Owner:** ak (cannot be automated — Firebase Console + Vercel UI only).

- [ ] **Step 1: Generate Web Push VAPID key in Firebase Console**

Navigate to Firebase Console → select the project → Project Settings (gear icon) → Cloud Messaging tab → "Web configuration" section → "Generate key pair." Copy the public key string (a base64url string ~88 chars).

- [ ] **Step 2: Confirm Cloud Messaging API is enabled**

In the same Cloud Messaging tab, "Cloud Messaging API (V1)" should show "Enabled." If it says "Disabled," click the three-dot menu → "Manage API in Google Cloud Console" → Enable.

- [ ] **Step 3: Add env var to `.env.local`**

Append to `/Users/ak/Documents/work/tth/.env.local`:

```
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<paste the public key from step 1>
```

- [ ] **Step 4: Add env var to Vercel**

Vercel Dashboard → project → Settings → Environment Variables → Add:
- Name: `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- Value: same key
- Environments: Production, Preview, Development

- [ ] **Step 5: Confirm with quick smoke**

Run `npm run dev` and visit `http://localhost:3000`. Page should load without errors. (The key isn't consumed yet — this just confirms env wiring doesn't break boot.)

No commit. Task 0 produces no code.

---

## Task 1: Add Firebase Messaging accessors (client + admin)

**Files:**
- Modify: `lib/firebase/client.ts`
- Modify: `lib/firebase/admin.ts`

- [ ] **Step 1: Add `getFirebaseMessaging` to `lib/firebase/client.ts`**

Replace the file contents:

```ts
"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { Auth, getAuth } from "firebase/auth";
import { Messaging, getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let analytics: Analytics | null | undefined;
let messaging: Messaging | null | undefined;

export function getFirebaseClientApp() {
  if (!app) {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    };

    app = getApps().length ? getApp() : initializeApp(config);
  }

  return app;
}

export function getFirebaseAuth() {
  if (!auth) {
    auth = getAuth(getFirebaseClientApp());
  }

  return auth;
}

export async function getFirebaseAnalytics() {
  if (analytics !== undefined) {
    return analytics;
  }

  if (!(await isSupported())) {
    analytics = null;
    return analytics;
  }

  analytics = getAnalytics(getFirebaseClientApp());
  return analytics;
}

export async function getFirebaseMessaging() {
  if (messaging !== undefined) {
    return messaging;
  }

  if (!(await isMessagingSupported())) {
    messaging = null;
    return messaging;
  }

  messaging = getMessaging(getFirebaseClientApp());
  return messaging;
}
```

- [ ] **Step 2: Add `getAdminMessaging` to `lib/firebase/admin.ts`**

Replace the file contents:

```ts
import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

let app: App | undefined;

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;

  if (!key) {
    throw new Error("Missing FIREBASE_PRIVATE_KEY");
  }

  return key.replace(/\\n/g, "\n");
}

export function getFirebaseAdminApp() {
  if (!app) {
    if (getApps().length) {
      app = getApp();
    } else {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: getPrivateKey()
        })
      });
    }
  }

  return app;
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getFirebaseAdminApp());
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/firebase/client.ts lib/firebase/admin.ts
git -c commit.gpgsign=false commit -m "Add Firebase Messaging accessors for client and admin SDKs"
```

---

## Task 2: Create `lib/push.ts` — STATUS_NOTIFICATIONS map (TDD)

**Files:**
- Create: `lib/push.ts`
- Create: `__tests__/push.test.ts`

- [ ] **Step 1: Write failing test for STATUS_NOTIFICATIONS shape**

Create `__tests__/push.test.ts`:

```ts
import { STATUS_NOTIFICATIONS } from "@/lib/push";

describe("STATUS_NOTIFICATIONS", () => {
  it("defines title and body for confirmed, preparing, shipped, delivered, cancelled", () => {
    expect(STATUS_NOTIFICATIONS.confirmed).toEqual({
      title: "Order confirmed",
      body: "We've accepted your order. Packing soon."
    });
    expect(STATUS_NOTIFICATIONS.preparing).toEqual({
      title: "Preparing your order",
      body: "Your bedsheets are being folded and packed."
    });
    expect(STATUS_NOTIFICATIONS.shipped).toEqual({
      title: "On the way",
      body: "Your parcel is with the courier. Tap to track."
    });
    expect(STATUS_NOTIFICATIONS.delivered).toEqual({
      title: "Delivered",
      body: "Hope you love your bedsheets. Thanks for choosing us."
    });
    expect(STATUS_NOTIFICATIONS.cancelled).toEqual({
      title: "Order cancelled",
      body: "Reach out on Instagram if this looks wrong."
    });
  });

  it("does not define a notification for order_received", () => {
    expect(STATUS_NOTIFICATIONS.order_received).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest __tests__/push.test.ts -t "STATUS_NOTIFICATIONS"`
Expected: FAIL — `Cannot find module '@/lib/push'`.

- [ ] **Step 3: Create `lib/push.ts` with the map**

```ts
import { BookingStatus } from "@/lib/types";

export const STATUS_NOTIFICATIONS: Partial<Record<BookingStatus, { title: string; body: string }>> = {
  confirmed: { title: "Order confirmed", body: "We've accepted your order. Packing soon." },
  preparing: { title: "Preparing your order", body: "Your bedsheets are being folded and packed." },
  shipped: { title: "On the way", body: "Your parcel is with the courier. Tap to track." },
  delivered: { title: "Delivered", body: "Hope you love your bedsheets. Thanks for choosing us." },
  cancelled: { title: "Order cancelled", body: "Reach out on Instagram if this looks wrong." }
};
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx jest __tests__/push.test.ts -t "STATUS_NOTIFICATIONS"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/push.ts __tests__/push.test.ts
git -c commit.gpgsign=false commit -m "Add STATUS_NOTIFICATIONS map keyed by booking status"
```

---

## Task 3: Add `tokenHash` helper to `lib/push.ts` (TDD)

**Files:**
- Modify: `lib/push.ts`
- Modify: `__tests__/push.test.ts`

- [ ] **Step 1: Add failing test**

In `__tests__/push.test.ts`, change the top import line from

```ts
import { STATUS_NOTIFICATIONS } from "@/lib/push";
```

to

```ts
import { STATUS_NOTIFICATIONS, tokenHash } from "@/lib/push";
```

Then append at the bottom of the file:

```ts
describe("tokenHash", () => {
  it("returns a stable sha256 hex string", () => {
    const hash = tokenHash("example-fcm-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash("example-fcm-token")).toBe(hash);
  });

  it("returns different hashes for different inputs", () => {
    expect(tokenHash("a")).not.toBe(tokenHash("b"));
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest __tests__/push.test.ts -t "tokenHash"`
Expected: FAIL — `tokenHash is not a function`.

- [ ] **Step 3: Implement `tokenHash`**

Append to `lib/push.ts`:

```ts
import crypto from "crypto";

export function tokenHash(fcmToken: string): string {
  return crypto.createHash("sha256").update(fcmToken).digest("hex");
}
```

Move the `import crypto from "crypto";` line to the top of the file with other imports.

- [ ] **Step 4: Run test, verify it passes**

Run: `npx jest __tests__/push.test.ts`
Expected: PASS, 4 tests total.

- [ ] **Step 5: Commit**

```bash
git add lib/push.ts __tests__/push.test.ts
git -c commit.gpgsign=false commit -m "Add tokenHash helper using sha256 hex"
```

---

## Task 4: Add `sendStatusPush` to `lib/push.ts` (TDD)

**Files:**
- Modify: `lib/push.ts`
- Modify: `__tests__/push.test.ts`

This is the riskiest function — it does the actual FCM multicast, pruning, and terminal-status cleanup. Tests must cover all four behaviors.

- [ ] **Step 1: Set up Firestore + messaging mocks at top of test file**

Add at the very top of `__tests__/push.test.ts` (before any imports of `@/lib/push`):

```ts
jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn(),
  getAdminMessaging: jest.fn()
}));
```

Then import the mocked functions just after the existing imports:

```ts
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/admin";

type MockedFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;
const mockGetAdminDb = getAdminDb as MockedFn<typeof getAdminDb>;
const mockGetAdminMessaging = getAdminMessaging as MockedFn<typeof getAdminMessaging>;
```

- [ ] **Step 2: Write failing test — zero tokens means no FCM call**

First, update the existing `@/lib/push` import line at the top of the file to also import `sendStatusPush`:

```ts
import { STATUS_NOTIFICATIONS, tokenHash, sendStatusPush } from "@/lib/push";
```

Then append to `__tests__/push.test.ts`:

```ts
describe("sendStatusPush", () => {
  let sendEachForMulticast: jest.Mock;
  let docs: Array<{ id: string; data: () => { token: string }; ref: { delete: jest.Mock } }>;
  let collectionGet: jest.Mock;
  let firestoreDocDelete: jest.Mock;

  beforeEach(() => {
    sendEachForMulticast = jest.fn();
    firestoreDocDelete = jest.fn().mockResolvedValue(undefined);
    docs = [];
    collectionGet = jest.fn(async () => ({ docs }));

    mockGetAdminDb.mockReturnValue({
      collection: () => ({
        doc: () => ({
          collection: () => ({
            get: collectionGet
          })
        })
      })
    } as unknown as ReturnType<typeof getAdminDb>);

    mockGetAdminMessaging.mockReturnValue({
      sendEachForMulticast
    } as unknown as ReturnType<typeof getAdminMessaging>);
  });

  it("does nothing when no tokens are subscribed", async () => {
    await sendStatusPush({ bookingId: "TTH-0001", token: "url-tok", status: "shipped" });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx jest __tests__/push.test.ts -t "sendStatusPush"`
Expected: FAIL — `sendStatusPush is not a function`.

- [ ] **Step 4: Implement minimal `sendStatusPush`**

Add this import line at the top of `lib/push.ts` (alongside the existing imports — `BookingStatus` is already imported):

```ts
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/admin";
```

Then append to `lib/push.ts`:

```ts
const TERMINAL_STATUSES: ReadonlyArray<BookingStatus> = ["delivered", "cancelled"];
const PRUNE_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument"
]);

export async function sendStatusPush(args: {
  bookingId: string;
  token: string;
  status: BookingStatus;
}): Promise<void> {
  const notification = STATUS_NOTIFICATIONS[args.status];
  if (!notification) return;

  const db = getAdminDb();
  const subsRef = db.collection("bookings").doc(args.bookingId).collection("fcmTokens");
  const snapshot = await subsRef.get();

  if (snapshot.docs.length === 0) return;

  const tokens = snapshot.docs.map((d) => d.data().token as string);
  const link = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/order/${args.bookingId}?token=${args.token}`;

  try {
    const response = await getAdminMessaging().sendEachForMulticast({
      tokens,
      notification,
      webpush: { fcmOptions: { link } }
    });

    let pruned = 0;
    let failed = 0;
    response.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code;
      if (code && PRUNE_ERROR_CODES.has(code)) {
        void snapshot.docs[i].ref.delete();
        pruned += 1;
      } else {
        failed += 1;
      }
    });

    console.log(
      JSON.stringify({
        event: "push.status_change",
        bookingId: args.bookingId,
        status: args.status,
        tokensFound: tokens.length,
        tokensSent: response.successCount,
        tokensFailed: failed,
        tokensPruned: pruned
      })
    );

    if (TERMINAL_STATUSES.includes(args.status)) {
      const remaining = await subsRef.get();
      await Promise.all(remaining.docs.map((d) => d.ref.delete()));
    }
  } catch (caughtError) {
    console.log(
      JSON.stringify({
        event: "push.status_change_error",
        bookingId: args.bookingId,
        status: args.status,
        error: caughtError instanceof Error ? caughtError.message : "unknown"
      })
    );
  }
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx jest __tests__/push.test.ts -t "does nothing when no tokens"`
Expected: PASS.

- [ ] **Step 6: Add test — multicast with correct payload**

Append inside the `describe("sendStatusPush"` block:

```ts
it("multicasts the configured notification + link for a status with subscribers", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://threadtheoryhome.in";
  docs = [
    { id: "h1", data: () => ({ token: "fcm-a" }), ref: { delete: firestoreDocDelete } },
    { id: "h2", data: () => ({ token: "fcm-b" }), ref: { delete: firestoreDocDelete } }
  ];
  sendEachForMulticast.mockResolvedValue({
    successCount: 2,
    failureCount: 0,
    responses: [{ success: true }, { success: true }]
  });

  await sendStatusPush({ bookingId: "TTH-0007", token: "url-tok", status: "shipped" });

  expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
  expect(sendEachForMulticast).toHaveBeenCalledWith({
    tokens: ["fcm-a", "fcm-b"],
    notification: STATUS_NOTIFICATIONS.shipped,
    webpush: {
      fcmOptions: {
        link: "https://threadtheoryhome.in/order/TTH-0007?token=url-tok"
      }
    }
  });
});
```

- [ ] **Step 7: Run, verify pass**

Run: `npx jest __tests__/push.test.ts -t "multicasts the configured notification"`
Expected: PASS.

- [ ] **Step 8: Add test — prunes tokens that come back not-registered**

Append:

```ts
it("deletes token docs whose responses indicate registration is gone", async () => {
  docs = [
    {
      id: "h1",
      data: () => ({ token: "good" }),
      ref: { delete: jest.fn().mockResolvedValue(undefined) }
    },
    {
      id: "h2",
      data: () => ({ token: "stale" }),
      ref: { delete: jest.fn().mockResolvedValue(undefined) }
    }
  ];
  sendEachForMulticast.mockResolvedValue({
    successCount: 1,
    failureCount: 1,
    responses: [
      { success: true },
      { success: false, error: { code: "messaging/registration-token-not-registered" } }
    ]
  });

  await sendStatusPush({ bookingId: "TTH-0008", token: "url-tok", status: "shipped" });

  expect(docs[0].ref.delete).not.toHaveBeenCalled();
  expect(docs[1].ref.delete).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 9: Run, verify pass**

Run: `npx jest __tests__/push.test.ts -t "deletes token docs"`
Expected: PASS.

- [ ] **Step 10: Add test — terminal status empties the subcollection**

Append:

```ts
it("empties the fcmTokens subcollection on terminal status", async () => {
  const del1 = jest.fn().mockResolvedValue(undefined);
  const del2 = jest.fn().mockResolvedValue(undefined);
  docs = [
    { id: "h1", data: () => ({ token: "t1" }), ref: { delete: del1 } },
    { id: "h2", data: () => ({ token: "t2" }), ref: { delete: del2 } }
  ];
  sendEachForMulticast.mockResolvedValue({
    successCount: 2,
    failureCount: 0,
    responses: [{ success: true }, { success: true }]
  });

  await sendStatusPush({ bookingId: "TTH-0009", token: "url-tok", status: "delivered" });

  expect(del1).toHaveBeenCalled();
  expect(del2).toHaveBeenCalled();
});
```

- [ ] **Step 11: Run, verify pass**

Run: `npx jest __tests__/push.test.ts -t "empties the fcmTokens"`
Expected: PASS.

- [ ] **Step 12: Add test — FCM throw is swallowed (never propagates)**

Append:

```ts
it("does not throw when FCM rejects", async () => {
  docs = [{ id: "h1", data: () => ({ token: "t" }), ref: { delete: jest.fn() } }];
  sendEachForMulticast.mockRejectedValue(new Error("FCM is down"));

  await expect(
    sendStatusPush({ bookingId: "TTH-0010", token: "url-tok", status: "shipped" })
  ).resolves.toBeUndefined();
});
```

- [ ] **Step 13: Run full file, verify all pass**

Run: `npx jest __tests__/push.test.ts`
Expected: PASS, ~9 tests.

- [ ] **Step 14: Commit**

```bash
git add lib/push.ts __tests__/push.test.ts
git -c commit.gpgsign=false commit -m "Add sendStatusPush with token pruning and terminal cleanup"
```

---

## Task 5: Wire `sendStatusPush` into PATCH `/api/bookings/[bookingId]`

**Files:**
- Modify: `app/api/bookings/[bookingId]/route.ts`
- Create: `__tests__/api-bookings-patch.test.ts`

- [ ] **Step 1: Write failing test that PATCH fires sendStatusPush on status change**

Create `__tests__/api-bookings-patch.test.ts`:

```ts
jest.mock("@/lib/auth", () => ({
  getAdminSession: jest.fn().mockResolvedValue({ uid: "admin" })
}));

jest.mock("@/lib/push", () => ({
  sendStatusPush: jest.fn().mockResolvedValue(undefined),
  STATUS_NOTIFICATIONS: {}
}));

jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn()
}));

import { PATCH } from "@/app/api/bookings/[bookingId]/route";
import { sendStatusPush } from "@/lib/push";
import { getAdminDb } from "@/lib/firebase/admin";

const mockSend = sendStatusPush as jest.MockedFunction<typeof sendStatusPush>;
const mockGetDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function mockBookingDoc(initial: Record<string, unknown>) {
  const state: Record<string, unknown> = { ...initial };
  return {
    set: jest.fn(async (updates: Record<string, unknown>) => {
      Object.assign(state, updates);
    }),
    get: jest.fn(async () => ({
      data: () => ({ ...state, createdAt: undefined, updatedAt: undefined })
    }))
  };
}

describe("PATCH /api/bookings/[bookingId] push trigger", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it("fires sendStatusPush with the new status when status is in the payload", async () => {
    const docRef = mockBookingDoc({
      bookingId: "TTH-0042",
      name: "x",
      phone: "x",
      address: "x",
      product: "x",
      status: "preparing",
      token: "url-tok"
    });
    mockGetDb.mockReturnValue({
      collection: () => ({ doc: () => docRef })
    } as unknown as ReturnType<typeof getAdminDb>);

    const req = new Request("http://t/api/bookings/TTH-0042", {
      method: "PATCH",
      body: JSON.stringify({ status: "shipped" })
    });

    await PATCH(req, { params: Promise.resolve({ bookingId: "TTH-0042" }) });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      bookingId: "TTH-0042",
      token: "url-tok",
      status: "shipped"
    });
  });

  it("does not fire sendStatusPush when payload has no status field", async () => {
    const docRef = mockBookingDoc({
      bookingId: "TTH-0043",
      name: "x",
      phone: "x",
      address: "x",
      product: "x",
      status: "preparing",
      token: "url-tok"
    });
    mockGetDb.mockReturnValue({
      collection: () => ({ doc: () => docRef })
    } as unknown as ReturnType<typeof getAdminDb>);

    const req = new Request("http://t/api/bookings/TTH-0043", {
      method: "PATCH",
      body: JSON.stringify({ notes: "updated note" })
    });

    await PATCH(req, { params: Promise.resolve({ bookingId: "TTH-0043" }) });

    expect(mockSend).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npx jest __tests__/api-bookings-patch.test.ts`
Expected: FAIL — `sendStatusPush` is not called.

- [ ] **Step 3: Modify the PATCH handler to fire push**

In `app/api/bookings/[bookingId]/route.ts`:

a) Add to imports near the top:

```ts
import { sendStatusPush } from "@/lib/push";
```

b) After the line `await bookingRef.set(updates, { merge: true });` and before `const snapshot = await bookingRef.get();`, insert nothing — the push needs the post-write state. Instead, after the `const data = snapshot.data();` line and after the `if (!data)` guard, before constructing the `BookingRecord booking`, add:

```ts
if (body.status !== undefined && data.status && data.token) {
  void sendStatusPush({
    bookingId,
    token: data.token,
    status: data.status
  });
}
```

This is fire-and-forget: no `await`. The PATCH response returns immediately; push delivery happens in the background.

- [ ] **Step 4: Run, verify pass**

Run: `npx jest __tests__/api-bookings-patch.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify existing PATCH behavior still works**

Run: `npm test` (full suite).
Expected: PASS — no existing tests broken.

- [ ] **Step 6: Commit**

```bash
git add app/api/bookings/[bookingId]/route.ts __tests__/api-bookings-patch.test.ts
git -c commit.gpgsign=false commit -m "Trigger sendStatusPush from PATCH bookings on status change"
```

---

## Task 6: Add POST/DELETE `/api/bookings/[bookingId]/subscriptions` (TDD)

**Files:**
- Create: `app/api/bookings/[bookingId]/subscriptions/route.ts`
- Create: `__tests__/api-bookings-subscriptions.test.ts`

The DELETE handler is added in the same task because both share the same `urlToken === booking.token` validation.

- [ ] **Step 1: Write failing test for POST happy path + validation**

Create `__tests__/api-bookings-subscriptions.test.ts`:

```ts
jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn()
}));

import { POST, DELETE } from "@/app/api/bookings/[bookingId]/subscriptions/route";
import { getAdminDb } from "@/lib/firebase/admin";
import { tokenHash } from "@/lib/push";

const mockGetDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

type SubDocState = { token: string; lastSeenAt: unknown };
type SubDocs = Map<string, SubDocState>;

function mockBookingDb(
  booking: { status: string; token: string } | null,
  subs: SubDocs
) {
  const subDocFor = (hash: string) => ({
    set: jest.fn(async (v: SubDocState) => {
      subs.set(hash, { ...subs.get(hash), ...v });
    }),
    delete: jest.fn(async () => {
      subs.delete(hash);
    }),
    get: jest.fn(async () => ({ exists: subs.has(hash) }))
  });

  const subCollection = {
    doc: (hash: string) => subDocFor(hash),
    get: jest.fn(async () => ({
      size: subs.size,
      docs: Array.from(subs.keys()).map((id) => ({ id }))
    }))
  };

  const bookingDoc = {
    get: jest.fn(async () => ({ exists: booking !== null, data: () => booking })),
    collection: () => subCollection
  };

  mockGetDb.mockReturnValue({
    collection: () => ({ doc: () => bookingDoc })
  } as unknown as ReturnType<typeof getAdminDb>);

  return { subs, subCollection };
}

function req(path: string, method: string, body: unknown) {
  return new Request(`http://t${path}`, { method, body: JSON.stringify(body) });
}

describe("POST /api/bookings/[bookingId]/subscriptions", () => {
  it("returns 400 when fields are missing", async () => {
    mockBookingDb({ status: "preparing", token: "tok" }, new Map());
    const r = await POST(req("/x", "POST", {}), {
      params: Promise.resolve({ bookingId: "TTH-1" })
    });
    expect(r.status).toBe(400);
  });

  it("returns 404 when urlToken does not match", async () => {
    mockBookingDb({ status: "preparing", token: "right" }, new Map());
    const r = await POST(
      req("/x", "POST", { urlToken: "wrong", fcmToken: "fcm" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(404);
  });

  it("returns 410 when booking is delivered", async () => {
    mockBookingDb({ status: "delivered", token: "tok" }, new Map());
    const r = await POST(
      req("/x", "POST", { urlToken: "tok", fcmToken: "fcm" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(410);
  });

  it("returns 429 when subcollection has 10+ subscriptions", async () => {
    const subs: SubDocs = new Map();
    for (let i = 0; i < 10; i++) subs.set(`h${i}`, { token: `t${i}`, lastSeenAt: 0 });
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await POST(
      req("/x", "POST", { urlToken: "tok", fcmToken: "new" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(429);
  });

  it("upserts the token doc keyed by sha256(fcmToken)", async () => {
    const subs: SubDocs = new Map();
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await POST(
      req("/x", "POST", { urlToken: "tok", fcmToken: "fcm-xyz", userAgent: "Mozilla" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );

    expect(r.status).toBe(200);
    expect(subs.has(tokenHash("fcm-xyz"))).toBe(true);
    expect(subs.get(tokenHash("fcm-xyz"))?.token).toBe("fcm-xyz");
  });
});

describe("DELETE /api/bookings/[bookingId]/subscriptions", () => {
  it("returns 404 when urlToken does not match", async () => {
    mockBookingDb({ status: "preparing", token: "right" }, new Map());
    const r = await DELETE(
      req("/x", "DELETE", { urlToken: "wrong", fcmToken: "fcm" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(404);
  });

  it("deletes the token doc and returns 200", async () => {
    const hash = tokenHash("fcm-zzz");
    const subs: SubDocs = new Map([[hash, { token: "fcm-zzz", lastSeenAt: 0 }]]);
    mockBookingDb({ status: "preparing", token: "tok" }, subs);

    const r = await DELETE(
      req("/x", "DELETE", { urlToken: "tok", fcmToken: "fcm-zzz" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );

    expect(r.status).toBe(200);
    expect(subs.has(hash)).toBe(false);
  });

  it("returns 200 when token doc does not exist (idempotent)", async () => {
    mockBookingDb({ status: "preparing", token: "tok" }, new Map());
    const r = await DELETE(
      req("/x", "DELETE", { urlToken: "tok", fcmToken: "absent" }),
      { params: Promise.resolve({ bookingId: "TTH-1" }) }
    );
    expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npx jest __tests__/api-bookings-subscriptions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/bookings/[bookingId]/subscriptions/route.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { tokenHash } from "@/lib/push";

const MAX_SUBSCRIPTIONS_PER_BOOKING = 10;
const TERMINAL_STATUSES = new Set(["delivered", "cancelled"]);

type Body = {
  urlToken?: string;
  fcmToken?: string;
  userAgent?: string;
};

async function readBooking(bookingId: string) {
  const ref = getAdminDb().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  return { ref, exists: snap.exists, data: snap.data() as { status: string; token: string } | undefined };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const body = (await request.json()) as Body;

  if (!body.urlToken || !body.fcmToken) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { ref, exists, data } = await readBooking(bookingId);
  if (!exists || !data || data.token !== body.urlToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (TERMINAL_STATUSES.has(data.status)) {
    return NextResponse.json({ error: "Order closed" }, { status: 410 });
  }

  const subs = ref.collection("fcmTokens");
  const existing = await subs.get();
  const hash = tokenHash(body.fcmToken);
  const isUpdate = existing.docs.some((d) => d.id === hash);

  if (!isUpdate && existing.size >= MAX_SUBSCRIPTIONS_PER_BOOKING) {
    return NextResponse.json({ error: "Too many devices" }, { status: 429 });
  }

  try {
    await subs.doc(hash).set(
      {
        token: body.fcmToken,
        userAgent: (body.userAgent || "").slice(0, 200),
        createdAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const body = (await request.json()) as Body;

  if (!body.urlToken || !body.fcmToken) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { ref, exists, data } = await readBooking(bookingId);
  if (!exists || !data || data.token !== body.urlToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await ref.collection("fcmTokens").doc(tokenHash(body.fcmToken)).delete();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
```

Note on the cap: the `isUpdate` check prevents an idempotent re-POST of an already-subscribed token from tripping the 10-device cap.

- [ ] **Step 4: Run, verify all tests pass**

Run: `npx jest __tests__/api-bookings-subscriptions.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/bookings/[bookingId]/subscriptions/route.ts __tests__/api-bookings-subscriptions.test.ts
git -c commit.gpgsign=false commit -m "Add POST and DELETE /subscriptions route with url-token validation"
```

---

## Task 7: Create the service worker `public/firebase-messaging-sw.js`

**Files:**
- Create: `public/firebase-messaging-sw.js`

- [ ] **Step 1: Create the SW file**

Create `public/firebase-messaging-sw.js`:

```js
/* eslint-disable */
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

// These values are public client config — safe to embed in a static file.
firebase.initializeApp({
  apiKey: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  messagingSenderId: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  if (!payload.notification) return;
  const { title, body } = payload.notification;
  const link = payload.fcmOptions?.link || "/";
  self.registration.showNotification(title, {
    body,
    icon: "/icon.svg",
    data: { link }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(link));
      if (existing) return existing.focus();
      return self.clients.openWindow(link);
    })
  );
});
```

- [ ] **Step 2: Replace placeholders with actual config values**

Open `.env.local`, copy the values of `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, and paste them in place of the `REPLACE_WITH_*` placeholders. These are public client values — they appear in the Firebase JS SDK init on the regular page anyway. Safe to commit to git.

- [ ] **Step 3: Verify the file loads at the expected URL**

Run `npm run dev` and open `http://localhost:3000/firebase-messaging-sw.js` in the browser. It should serve the JS file content.

- [ ] **Step 4: Commit**

```bash
git add public/firebase-messaging-sw.js
git -c commit.gpgsign=false commit -m "Add firebase-messaging-sw.js for background push handling"
```

---

## Task 8: Create `<NotifyCard />` client component (TDD on render guards)

**Files:**
- Create: `app/order/[bookingId]/notify-card.tsx`
- Create: `__tests__/notify-card.test.tsx`

Only the render-guard logic is unit-tested (jsdom can mock `navigator` and `window.matchMedia`). The permission/getToken/fetch flow is verified manually in Task 11.

- [ ] **Step 1: Write failing test for render guards**

Create `__tests__/notify-card.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { NotifyCard } from "@/app/order/[bookingId]/notify-card";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true
  });
}

function setMatchMedia(standalone: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query === "(display-mode: standalone)" ? standalone : false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }));
}

describe("<NotifyCard />", () => {
  beforeEach(() => {
    setMatchMedia(false);
  });

  it("renders nothing when serviceWorker is unavailable", () => {
    // jsdom default: no serviceWorker
    delete (window.navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    const { container } = render(
      <NotifyCard bookingId="TTH-1" token="t" status="preparing" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on terminal status", () => {
    (window.navigator as unknown as { serviceWorker: object }).serviceWorker = {};
    (window as unknown as { PushManager: object }).PushManager = {};
    const { container } = render(
      <NotifyCard bookingId="TTH-1" token="t" status="delivered" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the iOS hint card on iPhone Safari without standalone", () => {
    (window.navigator as unknown as { serviceWorker: object }).serviceWorker = {};
    (window as unknown as { PushManager: object }).PushManager = {};
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari");
    setMatchMedia(false);

    const { getByText, queryByRole } = render(
      <NotifyCard bookingId="TTH-1" token="t" status="preparing" />
    );

    expect(getByText(/Add to Home Screen/i)).toBeInTheDocument();
    expect(queryByRole("button", { name: /notify me/i })).toBeNull();
  });

  it("renders the idle CTA on Android Chrome", () => {
    (window.navigator as unknown as { serviceWorker: object }).serviceWorker = {};
    (window as unknown as { PushManager: object }).PushManager = {};
    (window as unknown as { Notification: { permission: string } }).Notification = {
      permission: "default"
    };
    setUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120");
    setMatchMedia(false);

    const { getByRole } = render(
      <NotifyCard bookingId="TTH-1" token="t" status="preparing" />
    );

    expect(getByRole("button", { name: /notify me/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npx jest __tests__/notify-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `notify-card.tsx`**

Create `app/order/[bookingId]/notify-card.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { BookingStatus } from "@/lib/types";
import { getFirebaseMessaging } from "@/lib/firebase/client";

type Props = {
  bookingId: string;
  token: string;
  status: BookingStatus;
};

type UiState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "ios-hint" }
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "subscribing" }
  | { kind: "success"; fcmToken: string }
  | { kind: "denied" }
  | { kind: "error" };

const TERMINAL: ReadonlyArray<BookingStatus> = ["delivered", "cancelled"];

function detectIosWithoutStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iPhone|iPad|iPod/.test(window.navigator.userAgent);
  if (!isIOS) return false;
  return !window.matchMedia("(display-mode: standalone)").matches;
}

function hasPushSupport(): boolean {
  if (typeof window === "undefined") return false;
  return "PushManager" in window && "serviceWorker" in window.navigator;
}

export function NotifyCard({ bookingId, token, status }: Props) {
  const [state, setState] = useState<UiState>({ kind: "loading" });

  useEffect(() => {
    if (TERMINAL.includes(status)) {
      setState({ kind: "unsupported" });
      return;
    }
    if (!hasPushSupport()) {
      setState({ kind: "unsupported" });
      return;
    }
    if (detectIosWithoutStandalone()) {
      setState({ kind: "ios-hint" });
      return;
    }
    const permission = (window as unknown as { Notification?: { permission: NotificationPermission } }).Notification?.permission;
    if (permission === "denied") {
      setState({ kind: "denied" });
      return;
    }
    setState({ kind: "idle" });
  }, [status]);

  async function handleSubscribe() {
    setState({ kind: "requesting" });
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState({ kind: "denied" });
        return;
      }
      if (permission !== "granted") {
        setState({ kind: "idle" });
        return;
      }

      setState({ kind: "subscribing" });
      const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        setState({ kind: "error" });
        return;
      }
      const { getToken } = await import("firebase/messaging");
      const fcmToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: reg
      });
      if (!fcmToken) {
        setState({ kind: "error" });
        return;
      }

      const res = await fetch(`/api/bookings/${bookingId}/subscriptions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          urlToken: token,
          fcmToken,
          userAgent: navigator.userAgent
        })
      });
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      setState({ kind: "success", fcmToken });
    } catch {
      setState({ kind: "error" });
    }
  }

  async function handleUnsubscribe() {
    if (state.kind !== "success") return;
    try {
      const messaging = await getFirebaseMessaging();
      if (messaging) {
        const { deleteToken } = await import("firebase/messaging");
        await deleteToken(messaging);
      }
      await fetch(`/api/bookings/${bookingId}/subscriptions`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urlToken: token, fcmToken: state.fcmToken })
      });
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "loading" || state.kind === "unsupported") {
    return null;
  }

  if (state.kind === "ios-hint") {
    return (
      <section className="tracking-info notify-card" aria-label="Enable notifications on iPhone">
        <span className="panel-label">Updates</span>
        <h3>Get a ping when this order moves</h3>
        <p>
          On iPhone, tap the <strong>Share</strong> button, then{" "}
          <strong>Add to Home Screen</strong> to enable updates.
        </p>
      </section>
    );
  }

  if (state.kind === "denied") {
    return (
      <section className="tracking-info notify-card" aria-label="Notifications blocked">
        <span className="panel-label">Updates</span>
        <p>Notifications are blocked. Enable them in your browser settings.</p>
      </section>
    );
  }

  if (state.kind === "success") {
    return (
      <section className="tracking-info notify-card" aria-label="Notifications enabled">
        <span className="panel-label">Updates</span>
        <p className="notify-success">✓ You&apos;ll be notified.</p>
        <button type="button" className="text-link notify-stop" onClick={handleUnsubscribe}>
          Stop notifications
        </button>
      </section>
    );
  }

  const busy = state.kind === "requesting" || state.kind === "subscribing";
  const buttonLabel =
    state.kind === "requesting" ? "Asking permission…" : state.kind === "subscribing" ? "Setting up…" : "Notify me";

  return (
    <section className="tracking-info notify-card" aria-label="Enable notifications">
      <span className="panel-label">Updates</span>
      <h3>Get a ping when this order moves</h3>
      <p>One tap. We&apos;ll only notify you about this order.</p>
      <button
        type="button"
        className="notify-button"
        onClick={handleSubscribe}
        disabled={busy}
      >
        {buttonLabel}
      </button>
      {state.kind === "error" ? (
        <p className="notify-error">Couldn&apos;t enable notifications. Try again.</p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run, verify tests pass**

Run: `npx jest __tests__/notify-card.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/order/[bookingId]/notify-card.tsx __tests__/notify-card.test.tsx
git -c commit.gpgsign=false commit -m "Add NotifyCard client component for opt-in push subscriptions"
```

---

## Task 9: Mount `<NotifyCard />` on the tracking page

**Files:**
- Modify: `app/order/[bookingId]/page.tsx`

- [ ] **Step 1: Add import**

In `app/order/[bookingId]/page.tsx`, add to the imports near the top (after the existing `TrackingNumberCopy` import):

```ts
import { NotifyCard } from "./notify-card";
```

- [ ] **Step 2: Mount the component above the "Need help?" line**

Locate this block in the JSX:

```tsx
          <p className="tracking-help-line reveal reveal-delay-3">
            Need help? Continue the conversation on{" "}
            <Link className="text-link" href={INSTAGRAM_URL}>
              Instagram
            </Link>
          </p>
```

Insert directly above it:

```tsx
          <NotifyCard
            bookingId={booking.bookingId}
            token={booking.token}
            status={booking.status}
          />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS — all tests across the suite green.

- [ ] **Step 5: Commit**

```bash
git add app/order/[bookingId]/page.tsx
git -c commit.gpgsign=false commit -m "Mount NotifyCard on the order tracking page"
```

---

## Task 10: Style the `<NotifyCard />`

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Verify existing tracking-info styles**

Run: `grep -n "tracking-info" app/globals.css | head -20`. Confirm the class is defined. The notify-card reuses it; we only add a few variants.

- [ ] **Step 2: Append notify-card styles**

Append to `app/globals.css`:

```css
/* Notify card on the tracking page */
.notify-card {
  margin-top: 1.5rem;
}

.notify-card .notify-button {
  margin-top: 0.75rem;
  padding: 0.6rem 1.1rem;
  border-radius: 999px;
  border: 1px solid var(--ink, #1d2740);
  background: var(--ink, #1d2740);
  color: #f6efe5;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, transform 120ms ease;
}

.notify-card .notify-button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.notify-card .notify-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.notify-card .notify-success {
  margin-top: 0.5rem;
  color: #2a6a3e;
  font-weight: 500;
}

.notify-card .notify-stop {
  display: inline-block;
  margin-top: 0.25rem;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.9rem;
  cursor: pointer;
}

.notify-card .notify-error {
  margin-top: 0.5rem;
  color: #a83232;
  font-size: 0.9rem;
}
```

(If `--ink` is not a variable in the existing CSS, the fallback color `#1d2740` matches the theme color from `app/manifest.ts`.)

- [ ] **Step 3: Run dev server, eyeball the card**

Run: `npm run dev`. Create a test booking via the admin UI, open the tracking link, confirm the card renders below the status timeline with consistent typography and spacing.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git -c commit.gpgsign=false commit -m "Style notify-card states on the tracking page"
```

---

## Task 11: Manual end-to-end verification

No code in this task — purely browser-based verification. Capture results in a comment on the PR description.

- [ ] **Step 1: Subscribe on desktop Chrome → status push arrives**

1. `npm run dev`.
2. Admin: create a booking, copy the tracking URL.
3. Open the tracking URL in desktop Chrome (regular, non-incognito).
4. Click "Notify me." Grant permission.
5. Card should show "✓ You'll be notified."
6. Admin: PATCH the booking status to `shipped`.
7. A system notification should appear within ~3 seconds with title "On the way."

- [ ] **Step 2: Notification click opens the tracking URL**

Click the notification from step 1. The tracking URL with the token should open (or focus the existing tab).

- [ ] **Step 3: Background push works (browser closed)**

Close the browser tab. Admin: PATCH status to `delivered`. Notification should still appear from the OS notification area (Chrome must still be running in the background, which is its default on macOS/Windows).

- [ ] **Step 4: Multi-device works**

Subscribe from a second browser (e.g., Firefox) on the same tracking URL. PATCH status. Both devices should ping.

- [ ] **Step 5: iPhone Safari without install shows hint card**

Open the tracking URL on an iPhone Safari (not added to home screen). Confirm: card shows the "Tap Share → Add to Home Screen" copy, and no "Notify me" button.

- [ ] **Step 6: Terminal status cleans up subscriptions**

After step 1's subscription, PATCH status to `delivered`. Then in Firebase Console → Firestore → `bookings/<id>/fcmTokens` — the subcollection should be empty.

- [ ] **Step 7: Repeat subscription does not duplicate doc**

On the same browser, click "Stop notifications," then "Notify me" again. Firestore should still show a single doc under `fcmTokens` for this device, not two.

- [ ] **Step 8: Capture verification results**

Add a checklist to the PR description (when opened) recording which devices were tested and pass/fail per step.

---

## Task 12: Open the pull request

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/push-notifications
```

- [ ] **Step 2: Open PR with the gh CLI**

```bash
gh pr create --title "Customer push notifications on order tracking" --body "$(cat <<'EOF'
## Summary
- Anonymous web push via FCM, gated by the existing tracking URL token (no login).
- Tracking page now mounts a NotifyCard for one-tap opt-in; service worker handles background pushes.
- PATCH /api/bookings/[id] fires sendStatusPush on status change; tokens that fail with not-registered are pruned; terminal status clears subscriptions.

Spec: docs/superpowers/specs/2026-05-30-push-notifications-design.md

## Test plan
- [ ] npm test passes
- [ ] Manual verification (Task 11) on desktop Chrome
- [ ] Manual verification on Android Chrome
- [ ] iPhone Safari shows hint card without "Notify me" button
- [ ] iPhone Safari (PWA installed) subscribes successfully
- [ ] Firestore fcmTokens subcollection empties on delivered

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

(Run by the implementer before declaring done.)

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All manual verification steps in Task 11 completed
- [ ] No `console.log` statements left in client code (server-side structured logs in `lib/push.ts` are intentional)
- [ ] `NEXT_PUBLIC_FIREBASE_VAPID_KEY` set in Vercel for Production and Preview
- [ ] Firebase Console Cloud Messaging API confirmed enabled
