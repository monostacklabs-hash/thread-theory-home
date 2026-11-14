/**
 * JSON contract between the static pages and the API Worker (worker/).
 * Every error response is `{ error: string }` with a non-2xx status.
 */
import type { BookingRecord, BookingStatus } from "@/lib/types";

/**
 * What the public order-tracking page may see. Personal details are masked
 * on the server; the raw name, phone, email and address never leave the API.
 */
export type PublicOrder = {
  bookingId: string;
  status: BookingStatus;
  product: string;
  instagramPostUrl: string | null;
  notes: string;
  indiaPostTrackingNumber: string | null;
  createdAt?: string;
  maskedName: string;
  maskedPhone: string;
  /** null when the booking has no email. */
  maskedEmail: string | null;
  /** null when the booking has no address. */
  maskedAddress: string | null;
};

/** GET /api/orders/:bookingId?token=…  (public; 404 when the id or token is wrong) */
export type OrderResponse = { order: PublicOrder };

/** GET /api/admin/me  (401 when signed out) */
export type AdminMeResponse = { email: string };

/** POST /api/admin/session  body { idToken }   ·   POST /api/admin/logout */
export type OkResponse = { ok: true };

/** GET /api/bookings  (admin; newest first) */
export type BookingsResponse = { bookings: BookingRecord[] };

/** GET /api/bookings/:bookingId  (admin; 404 when missing)  ·  PATCH /api/bookings/:bookingId */
export type BookingResponse = { booking: BookingRecord };

/** POST /api/bookings  (admin) */
export type CreateBookingResponse = { booking: BookingRecord; trackingUrl: string };

/** POST /api/bookings/:bookingId/token  (admin) */
export type RegenerateTokenResponse = { bookingId: string; token: string; trackingUrl: string };

/**
 * POST and DELETE /api/bookings/:bookingId/subscriptions
 * body { urlToken, fcmToken, userAgent? }  (public, checked against the booking token)
 * → OkResponse; 404 wrong token, 410 order closed, 429 too many devices.
 */
