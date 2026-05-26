import crypto from "crypto";
import { BOOKING_STATUSES, BookingStatus, CreateBookingInput } from "@/lib/types";

export const BOOKING_PREFIX = "TTH";

export const STATUS_LABELS: Record<BookingStatus, string> = {
  order_received: "Order received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

export function formatBookingId(sequence: number) {
  return `${BOOKING_PREFIX}-${sequence.toString().padStart(4, "0")}`;
}

export function generateTrackingToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}

const INSTAGRAM_HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;
const INSTAGRAM_POST_URL_PATTERN =
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/;
const INDIA_POST_TRACKING_PATTERN = /^[A-Z]{2}\d{9}IN$/;

export function normalizeInstagramHandle(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/^@/, "").toLowerCase();
  if (!cleaned) return null;
  if (!INSTAGRAM_HANDLE_PATTERN.test(cleaned)) {
    throw new Error("Invalid Instagram handle");
  }
  return cleaned;
}

export function normalizeInstagramPostUrl(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input.trim();
  if (!cleaned) return null;
  if (!INSTAGRAM_POST_URL_PATTERN.test(cleaned)) {
    throw new Error("Invalid Instagram post URL");
  }
  return cleaned;
}

export function normalizeIndiaPostTrackingNumber(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  if (!INDIA_POST_TRACKING_PATTERN.test(cleaned)) {
    throw new Error("Invalid India Post tracking number (expected format: EE123456789IN)");
  }
  return cleaned;
}

export function validateCreateBookingInput(payload: Partial<CreateBookingInput>) {
  const requiredFields = ["name", "phone", "address", "product"] as const;

  for (const field of requiredFields) {
    if (!payload[field]?.trim()) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return {
    name: payload.name!.trim(),
    phone: payload.phone!.trim(),
    email: payload.email?.trim() || null,
    instagramHandle: normalizeInstagramHandle(payload.instagramHandle),
    address: payload.address!.trim(),
    product: payload.product!.trim(),
    instagramPostUrl: normalizeInstagramPostUrl(payload.instagramPostUrl),
    indiaPostTrackingNumber: normalizeIndiaPostTrackingNumber(payload.indiaPostTrackingNumber),
    notes: payload.notes?.trim() || ""
  };
}

const bookingDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

export function formatBookingDate(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return bookingDateFormatter.format(date);
}

export function buildTrackingUrl({
  siteUrl,
  bookingId,
  token
}: {
  siteUrl: string;
  bookingId: string;
  token: string;
}) {
  return `${siteUrl.replace(/\/$/, "")}/order/${bookingId}?token=${token}`;
}

export function maskName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return `${trimmed[0] || ""}*`;
  return `${trimmed.slice(0, 2)}${"*".repeat(Math.max(2, trimmed.length - 2))}`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "Hidden";
  if (digits.length <= 4) return `••${digits.slice(-2)}`;
  return `••••••${digits.slice(-4)}`;
}

export function maskEmail(email: string | null) {
  if (!email) return "Not provided";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Hidden";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function maskInstagramHandle(handle: string | null) {
  if (!handle) return "Not provided";
  if (handle.length <= 2) return `${handle[0] || ""}*`;
  return `${handle.slice(0, 2)}${"*".repeat(Math.max(2, handle.length - 2))}`;
}

export function maskAddress(address: string) {
  if (!address.trim()) return "Hidden";
  return "Address hidden for privacy";
}
