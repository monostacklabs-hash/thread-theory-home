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

const MAX_RECIPIENTS = 10;

type RecipientPrefill = {
  name: string;
  phone: string;
  address: string;
  bookingId: string;
};

async function loadRecipient(bookingId: string): Promise<RecipientPrefill | null> {
  const snapshot = await getAdminDb().collection("bookings").doc(bookingId).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};

  return {
    name: typeof data.name === "string" ? data.name : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    address: typeof data.address === "string" ? data.address : "",
    bookingId: typeof data.bookingId === "string" ? data.bookingId : bookingId
  };
}

function normalizeBookingIds(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const trimmed = values.map((value) => value.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const value of trimmed) {
    if (!unique.includes(value)) {
      unique.push(value);
    }
    if (unique.length >= MAX_RECIPIENTS) break;
  }
  return unique;
}

type ShippingLabelPageProps = {
  searchParams: Promise<{ bookingId?: string | string[] }>;
};

export default async function ShippingLabelPage({ searchParams }: ShippingLabelPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const bookingIds = normalizeBookingIds(params.bookingId);

  const loaded = await Promise.all(bookingIds.map((id) => loadRecipient(id)));
  const initialRecipients: RecipientPrefill[] = loaded.filter(
    (entry): entry is RecipientPrefill => entry !== null
  );

  if (initialRecipients.length === 0) {
    initialRecipients.push({ name: "", phone: "", address: "", bookingId: "" });
  }

  return <ShippingLabelClient initialRecipients={initialRecipients} />;
}
