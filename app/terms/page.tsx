import { PolicyShell } from "@/components/policy-shell";

export default function TermsPage() {
  return (
    <PolicyShell
      eyebrow="Terms of Service"
      title="This site supports trust and tracking. Orders are still confirmed manually."
      intro="By using this website, you agree to the operating model of Thread Theory Home as an Instagram-first, manually confirmed order business."
    >
      <div className="policy-stack">
        <section>
          <h2>Order process</h2>
          <p>
            This website does not provide direct checkout. Orders are discussed and confirmed over
            Instagram. Bookings are created manually after confirmation.
          </p>
        </section>
        <section>
          <h2>Product information</h2>
          <p>
            We aim to present product details accurately, but minor differences in color, texture,
            or appearance may occur due to screens, lighting, or photography.
          </p>
        </section>
        <section>
          <h2>Pricing and availability</h2>
          <p>
            Pricing and availability may change before order confirmation. A product is not reserved
            until the order has been confirmed directly with us.
          </p>
        </section>
        <section>
          <h2>Customer responsibility</h2>
          <p>
            Customers are responsible for sharing correct shipping and contact details before the
            order is confirmed.
          </p>
        </section>
        <section>
          <h2>Tracking access</h2>
          <p>
            Tracking links are private. Anyone with the valid link may view the order status, so
            customers should keep the link confidential.
          </p>
        </section>
      </div>
    </PolicyShell>
  );
}
