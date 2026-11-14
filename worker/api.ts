/**
 * JSON API served by the Worker. Shapes are in lib/api-types.ts.
 */
import type {
  AdminMeResponse,
  BookingResponse,
  BookingsResponse,
  CreateBookingResponse,
  OkResponse,
  OrderResponse,
  RegenerateTokenResponse
} from "@/lib/api-types";
import {
  buildTrackingUrl,
  formatBookingId,
  generateTrackingToken,
  isBookingStatus,
  maskAddress,
  maskEmail,
  maskName,
  maskPhone,
  normalizeIndiaPostTrackingNumber,
  normalizeInstagramHandle,
  normalizeInstagramPostUrl,
  validateCreateBookingInput
} from "@/lib/bookings";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue, type DocumentData } from "@/lib/firebase/firestore";
import { sendStatusPush, tokenHash } from "@/lib/push";
import { TERMINAL_STATUSES, type BookingRecord, type BookingStatus } from "@/lib/types";
import type { Env, ExecutionContext } from "./env";
import {
  assertNotRevoked,
  clearedSessionCookie,
  createSessionToken,
  getAdminSession,
  isAllowedAdminEmail,
  sessionCookie,
  verifyIdToken
} from "./session";

const MAX_SUBSCRIPTIONS_PER_BOOKING = 10;

type Context = {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  url: URL;
  /** Decoded path parameters, in order. */
  params: string[];
};

type Handler = (context: Context) => Promise<Response>;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers
    }
  });
}

function siteUrl(env: Env) {
  return env.SITE_URL || "http://localhost:3000";
}

function toBookingRecord(data: DocumentData): BookingRecord {
  return {
    bookingId: data.bookingId,
    name: data.name,
    phone: data.phone,
    email: data.email || null,
    instagramHandle: data.instagramHandle || null,
    address: data.address,
    product: data.product,
    instagramPostUrl: data.instagramPostUrl || null,
    indiaPostTrackingNumber: data.indiaPostTrackingNumber || null,
    notes: data.notes || "",
    status: data.status,
    token: data.token,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || undefined,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || undefined
  };
}

/** Wraps a handler so it only runs for a signed-in admin. */
function admin(handler: Handler): Handler {
  return async (context) => {
    const session = await getAdminSession(context.request, context.env);
    if (!session) return json({ error: "Unauthorized" }, 401);
    return handler(context);
  };
}

// ---------- admin session ----------

const createSession: Handler = async ({ request, env }) => {
  try {
    const body = (await request.json()) as { idToken?: string };

    if (!body.idToken) {
      return json({ error: "Missing ID token" }, 400);
    }

    const decoded = await verifyIdToken(body.idToken);

    if (!decoded.email || !isAllowedAdminEmail(decoded.email, env.ADMIN_EMAILS)) {
      return json({ error: "This account is not allowed" }, 403);
    }

    // An ID token stays valid for up to an hour after the account is disabled
    // or its sessions are revoked, so check the account itself before trading
    // the token for a five-day session.
    await assertNotRevoked(decoded.uid, decoded.authTime, { fresh: true });

    const token = await createSessionToken({ uid: decoded.uid, email: decoded.email }, env);
    return json({ ok: true } satisfies OkResponse, 200, {
      "set-cookie": sessionCookie(request, token)
    });
  } catch (error) {
    console.error("admin/session failed", error);
    return json({ error: "Could not create admin session" }, 401);
  }
};

const logout: Handler = async ({ request }) =>
  json({ ok: true } satisfies OkResponse, 200, { "set-cookie": clearedSessionCookie(request) });

const me: Handler = async ({ request, env }) => {
  const session = await getAdminSession(request, env);
  if (!session) return json({ error: "Unauthorized" }, 401);
  return json({ email: session.email } satisfies AdminMeResponse);
};

// ---------- bookings (admin) ----------

const listBookings: Handler = async () => {
  const snapshot = await getAdminDb().collection("bookings").orderBy("createdAt", "desc").get();
  const bookings = snapshot.docs.map((doc) => toBookingRecord(doc.data()));
  return json({ bookings } satisfies BookingsResponse);
};

const createBooking: Handler = async ({ request, env }) => {
  try {
    const payload = validateCreateBookingInput(await request.json());
    const db = getAdminDb();

    const result = await db.runTransaction(async (transaction) => {
      const counterRef = db.collection("meta").doc("counters");
      const counterSnapshot = await transaction.get(counterRef);
      const currentCount = counterSnapshot.exists ? counterSnapshot.data()?.bookingCount || 0 : 0;
      const nextCount = currentCount + 1;
      const bookingId = formatBookingId(nextCount);
      const token = generateTrackingToken();
      const bookingRef = db.collection("bookings").doc(bookingId);

      transaction.set(counterRef, { bookingCount: nextCount }, { merge: true });
      transaction.set(bookingRef, {
        bookingId,
        ...payload,
        status: "order_received" satisfies BookingStatus,
        token,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      return { bookingId, token };
    });

    const now = new Date().toISOString();
    const booking: BookingRecord = {
      bookingId: result.bookingId,
      ...payload,
      status: "order_received",
      token: result.token,
      createdAt: now,
      updatedAt: now
    };

    return json({
      booking,
      trackingUrl: buildTrackingUrl({
        siteUrl: siteUrl(env),
        bookingId: result.bookingId,
        token: result.token
      })
    } satisfies CreateBookingResponse);
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Unable to create booking";
    return json({ error: message }, 400);
  }
};

const getBooking: Handler = async ({ params }) => {
  const snapshot = await getAdminDb().collection("bookings").doc(params[0]).get();
  const data = snapshot.exists ? snapshot.data() : undefined;

  if (!data) {
    return json({ error: "Booking not found" }, 404);
  }

  return json({ booking: toBookingRecord(data) } satisfies BookingResponse);
};

type PatchBookingBody = {
  status?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  instagramHandle?: string | null;
  address?: string;
  product?: string;
  instagramPostUrl?: string | null;
  indiaPostTrackingNumber?: string | null;
  notes?: string;
};

const patchBooking: Handler = async ({ request, ctx, params }) => {
  const bookingId = params[0];

  try {
    const body = (await request.json()) as PatchBookingBody;
    const updates: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!isBookingStatus(body.status)) {
        return json({ error: "Invalid booking status" }, 400);
      }
      updates.status = body.status;
    }

    const requiredText = { name: body.name, phone: body.phone, address: body.address, product: body.product };
    for (const [field, value] of Object.entries(requiredText)) {
      if (value === undefined) continue;
      const trimmed = value.trim();
      if (!trimmed) {
        return json({ error: `${field} cannot be empty` }, 400);
      }
      updates[field] = trimmed;
    }

    if (body.email !== undefined) {
      updates.email = body.email ? body.email.trim() || null : null;
    }
    if (body.instagramHandle !== undefined) {
      updates.instagramHandle = normalizeInstagramHandle(body.instagramHandle);
    }
    if (body.instagramPostUrl !== undefined) {
      updates.instagramPostUrl = normalizeInstagramPostUrl(body.instagramPostUrl);
    }
    if (body.indiaPostTrackingNumber !== undefined) {
      updates.indiaPostTrackingNumber = normalizeIndiaPostTrackingNumber(
        body.indiaPostTrackingNumber
      );
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes.trim();
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "No fields to update" }, 400);
    }

    updates.updatedAt = FieldValue.serverTimestamp();
    const bookingRef = getAdminDb().collection("bookings").doc(bookingId);
    await bookingRef.set(updates, { merge: true });

    const snapshot = await bookingRef.get();
    const data = snapshot.data();

    if (!data) {
      return json({ error: "Booking not found" }, 404);
    }

    if (body.status !== undefined && data.status && data.token) {
      // Runs after the response is sent; sendStatusPush logs its own failures.
      ctx.waitUntil(sendStatusPush({ bookingId, token: data.token, status: data.status }));
    }

    return json({ booking: toBookingRecord(data) } satisfies BookingResponse);
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Unable to update booking";
    return json({ error: message }, 400);
  }
};

const regenerateToken: Handler = async ({ env, params }) => {
  const bookingId = params[0];
  const bookingRef = getAdminDb().collection("bookings").doc(bookingId);
  const token = generateTrackingToken();

  await bookingRef.set({ token, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  const snapshot = await bookingRef.get();

  if (!snapshot.exists) {
    return json({ error: "Booking not found" }, 404);
  }

  return json({
    bookingId,
    token,
    trackingUrl: buildTrackingUrl({ siteUrl: siteUrl(env), bookingId, token })
  } satisfies RegenerateTokenResponse);
};

// ---------- public ----------

const getOrder: Handler = async ({ url, params }) => {
  const token = url.searchParams.get("token");
  if (!token) return json({ error: "Not found" }, 404);

  const snapshot = await getAdminDb().collection("bookings").doc(params[0]).get();
  const data = snapshot.exists ? snapshot.data() : undefined;

  if (!data || !data.token || data.token !== token) {
    return json({ error: "Not found" }, 404);
  }

  const booking = toBookingRecord(data);

  return json({
    order: {
      bookingId: booking.bookingId,
      status: booking.status,
      product: booking.product,
      instagramPostUrl: booking.instagramPostUrl,
      notes: booking.notes,
      indiaPostTrackingNumber: booking.indiaPostTrackingNumber,
      createdAt: booking.createdAt,
      maskedName: maskName(booking.name || ""),
      maskedPhone: maskPhone(booking.phone || ""),
      maskedEmail: booking.email ? maskEmail(booking.email) : null,
      maskedAddress: (booking.address || "").trim() ? maskAddress(booking.address) : null
    }
  } satisfies OrderResponse);
};

type SubscriptionBody = {
  urlToken?: string;
  fcmToken?: string;
  userAgent?: string;
};

async function readBooking(bookingId: string) {
  const ref = getAdminDb().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  return { ref, exists: snap.exists, data: snap.data() as { status: string; token: string } | undefined };
}

const subscribe: Handler = async ({ request, params }) => {
  const bookingId = params[0];
  const body = (await request.json()) as SubscriptionBody;

  if (!body.urlToken || !body.fcmToken) {
    return json({ error: "Missing fields" }, 400);
  }

  const { ref, exists, data } = await readBooking(bookingId);
  if (!exists || !data || data.token !== body.urlToken) {
    return json({ error: "Not found" }, 404);
  }
  if ((TERMINAL_STATUSES as ReadonlyArray<string>).includes(data.status)) {
    return json({ error: "Order closed" }, 410);
  }

  const subs = ref.collection("fcmTokens");
  const existing = await subs.get();
  const hash = tokenHash(body.fcmToken);
  const isUpdate = existing.docs.some((d) => d.id === hash);

  if (!isUpdate && existing.size >= MAX_SUBSCRIPTIONS_PER_BOOKING) {
    return json({ error: "Too many devices" }, 429);
  }

  try {
    await subs.doc(hash).set(
      {
        token: body.fcmToken,
        userAgent: (body.userAgent || "").slice(0, 200),
        ...(isUpdate ? {} : { createdAt: FieldValue.serverTimestamp() }),
        lastSeenAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return json({ ok: true } satisfies OkResponse);
  } catch (caughtError) {
    console.error(
      JSON.stringify({
        event: "subscriptions.write_error",
        bookingId,
        error: caughtError instanceof Error ? caughtError.message : "unknown"
      })
    );
    return json({ error: "Write failed" }, 500);
  }
};

const unsubscribe: Handler = async ({ request, params }) => {
  const bookingId = params[0];
  const body = (await request.json()) as SubscriptionBody;

  if (!body.urlToken || !body.fcmToken) {
    return json({ error: "Missing fields" }, 400);
  }

  const { ref, exists, data } = await readBooking(bookingId);
  if (!exists || !data || data.token !== body.urlToken) {
    return json({ error: "Not found" }, 404);
  }

  try {
    await ref.collection("fcmTokens").doc(tokenHash(body.fcmToken)).delete();
    return json({ ok: true } satisfies OkResponse);
  } catch (caughtError) {
    console.error(
      JSON.stringify({
        event: "subscriptions.delete_error",
        bookingId,
        error: caughtError instanceof Error ? caughtError.message : "unknown"
      })
    );
    return json({ error: "Delete failed" }, 500);
  }
};

// ---------- routing ----------

/** Path segments after /api; ":" marks a parameter. */
const ROUTES: Array<{ path: string[]; methods: Record<string, Handler> }> = [
  { path: ["admin", "session"], methods: { POST: createSession } },
  { path: ["admin", "logout"], methods: { POST: logout } },
  { path: ["admin", "me"], methods: { GET: me } },
  { path: ["bookings"], methods: { GET: admin(listBookings), POST: admin(createBooking) } },
  { path: ["bookings", ":"], methods: { GET: admin(getBooking), PATCH: admin(patchBooking) } },
  { path: ["bookings", ":", "token"], methods: { POST: admin(regenerateToken) } },
  { path: ["bookings", ":", "subscriptions"], methods: { POST: subscribe, DELETE: unsubscribe } },
  { path: ["orders", ":"], methods: { GET: getOrder } }
];

function matchRoute(segments: string[]) {
  for (const route of ROUTES) {
    if (route.path.length !== segments.length) continue;

    const params: string[] = [];
    const matches = route.path.every((part, index) => {
      if (part !== ":") return part === segments[index];
      if (!segments[index]) return false;
      params.push(segments[index]);
      return true;
    });

    if (matches) return { route, params };
  }
  return null;
}

export async function handleApi(request: Request, env: Env, ctx: ExecutionContext, url: URL) {
  let segments: string[];
  try {
    segments = url.pathname
      .replace(/\/+$/, "")
      .split("/")
      .slice(2)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return json({ error: "Not found" }, 404);
  }

  const match = matchRoute(segments);
  // A decoded "/" would let one path segment address a different document.
  if (!match || match.params.some((param) => param.includes("/"))) {
    return json({ error: "Not found" }, 404);
  }

  const handler = match.route.methods[request.method];
  if (!handler) {
    return json({ error: "Method not allowed" }, 405, {
      allow: Object.keys(match.route.methods).join(", ")
    });
  }

  try {
    return await handler({ request, env, ctx, url, params: match.params });
  } catch (error) {
    console.error("api handler failed", request.method, url.pathname, error);
    return json({ error: "Internal error" }, 500);
  }
}
