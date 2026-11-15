import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { PublicFooter } from "@/components/public-footer";
import { OrderTracking, OrderTrackingLoading } from "./order-tracking";

export const metadata: Metadata = {
  title: "Order Tracking",
  robots: {
    index: false,
    follow: false
  }
};

export default function OrderTrackingPage() {
  return (
    <div className="page-shell">
      <Nav />
      <main className="tracking-shell">
        <div className="container">
          <Suspense fallback={<OrderTrackingLoading />}>
            <OrderTracking />
          </Suspense>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
