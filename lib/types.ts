export const BOOKING_TIMELINE = [
  "order_received",
  "confirmed",
  "preparing",
  "shipped",
  "delivered"
] as const;

export const BOOKING_STATUSES = [...BOOKING_TIMELINE, "cancelled"] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const TERMINAL_STATUSES = ["delivered", "cancelled"] as const satisfies ReadonlyArray<BookingStatus>;

export type BookingRecord = {
  bookingId: string;
  name: string;
  phone: string;
  email: string | null;
  instagramHandle: string | null;
  address: string;
  product: string;
  instagramPostUrl: string | null;
  indiaPostTrackingNumber: string | null;
  notes: string;
  status: BookingStatus;
  token: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateBookingInput = {
  name: string;
  phone: string;
  email?: string;
  instagramHandle?: string;
  address: string;
  product: string;
  instagramPostUrl?: string;
  indiaPostTrackingNumber?: string;
  notes?: string;
};
