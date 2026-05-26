import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import ShippingLabelClient from "./shipping-label-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping Label",
  robots: {
    index: false,
    follow: false
  }
};

type RecipientPrefill = {
  name: string;
  phone: string;
  address: string;
  bookingId: string;
};

async function loadRecipient(bookingId: string | undefined): Promise<RecipientPrefill> {
  const empty: RecipientPrefill = { name: "", phone: "", address: "", bookingId: "" };

  if (!bookingId) {
    return empty;
  }

  const snapshot = await getAdminDb().collection("bookings").doc(bookingId).get();

  if (!snapshot.exists) {
    return empty;
  }

  const data = snapshot.data() ?? {};

  return {
    name: typeof data.name === "string" ? data.name : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    address: typeof data.address === "string" ? data.address : "",
    bookingId: typeof data.bookingId === "string" ? data.bookingId : bookingId
  };
}

type ShippingLabelPageProps = {
  searchParams: Promise<{ bookingId?: string | string[] }>;
};

export default async function ShippingLabelPage({ searchParams }: ShippingLabelPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const rawBookingId = params.bookingId;
  const bookingId = Array.isArray(rawBookingId) ? rawBookingId[0] : rawBookingId;
  const trimmedBookingId = bookingId?.trim() || undefined;

  const initialRecipient = await loadRecipient(trimmedBookingId);

  return <ShippingLabelClient initialRecipient={initialRecipient} />;
}
