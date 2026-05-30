import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { requireAdminSession } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { BookingRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

async function getBookings(): Promise<BookingRecord[]> {
  const snapshot = await getAdminDb().collection("bookings").orderBy("createdAt", "desc").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

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
    } satisfies BookingRecord;
  });
}

export default async function AdminPage() {
  const session = await requireAdminSession();
  const bookings = await getBookings();

  return (
    <main className="admin-shell">
      <div className="container">
        <section className="admin-header reveal">
          <div className="admin-header-top">
            <div className="admin-identity">
              <span className="eyebrow">Admin</span>
              <span className="admin-email">{session.email}</span>
            </div>
            <SignOutButton />
          </div>
          <h1>Orders</h1>
          <p>Create a booking after the DM is confirmed, then copy the tracking link to send back on Instagram.</p>
        </section>

        <AdminDashboard initialBookings={bookings} />
      </div>
      <footer className="admin-foot">
        <div className="container admin-foot-inner">
          <span>Thread Theory · Admin</span>
          <span>Signed in as {session.email}</span>
        </div>
      </footer>
    </main>
  );
}
