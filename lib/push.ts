import { BookingStatus } from "@/lib/types";

export const STATUS_NOTIFICATIONS: Partial<Record<BookingStatus, { title: string; body: string }>> = {
  confirmed: { title: "Order confirmed", body: "We've accepted your order. Packing soon." },
  preparing: { title: "Preparing your order", body: "Your bedsheets are being folded and packed." },
  shipped: { title: "On the way", body: "Your parcel is with the courier. Tap to track." },
  delivered: { title: "Delivered", body: "Hope you love your bedsheets. Thanks for choosing us." },
  cancelled: { title: "Order cancelled", body: "Reach out on Instagram if this looks wrong." }
};
