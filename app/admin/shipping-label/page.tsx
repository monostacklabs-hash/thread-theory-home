import type { Metadata } from "next";
import { Suspense } from "react";
import { ShippingLabelLoader, ShippingLabelLoading } from "./shipping-label-loader";

export const metadata: Metadata = {
  title: "Shipping Label",
  robots: {
    index: false,
    follow: false
  }
};

export default function ShippingLabelPage() {
  return (
    <Suspense fallback={<ShippingLabelLoading />}>
      <ShippingLabelLoader />
    </Suspense>
  );
}
