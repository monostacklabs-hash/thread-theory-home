export const BOOKING_STATUSES = [
  "order_received",
  "confirmed",
  "preparing",
  "delivered"
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingRecord = {
  bookingId: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  product: string;
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
  address: string;
  product: string;
  notes?: string;
};
