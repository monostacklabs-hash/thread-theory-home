import crypto from "crypto";
import { BOOKING_STATUSES, BookingStatus, CreateBookingInput } from "@/lib/types";

export const BOOKING_PREFIX = "TTH";

export const STATUS_LABELS: Record<BookingStatus, string> = {
  order_received: "Order Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  delivered: "Delivered"
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
    address: payload.address!.trim(),
    product: payload.product!.trim(),
    notes: payload.notes?.trim() || ""
  };
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

export function maskAddress(address: string) {
  if (!address.trim()) return "Hidden";
  return "Address hidden for privacy";
}
