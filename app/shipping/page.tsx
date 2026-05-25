import { PolicyShell } from "@/components/policy-shell";

export default function ShippingPage() {
  return (
    <PolicyShell
      eyebrow="Shipping & Delivery"
      title="Every order is confirmed manually before dispatch expectations are shared."
      intro="Because Thread Theory Home operates in small volume, delivery timing is communicated directly during the Instagram order conversation."
    >
      <div className="policy-stack">
        <section>
          <h2>Order confirmation first</h2>
          <p>
            Orders are only treated as confirmed after the Instagram conversation is complete and
            the booking has been created by our team.
          </p>
        </section>
        <section>
          <h2>Dispatch timing</h2>
          <p>
            Dispatch and delivery estimates may vary based on product availability, courier timing,
            and destination. Any timeline shared during order confirmation is an estimate, not a
            guaranteed deadline.
          </p>
        </section>
        <section>
          <h2>Address accuracy</h2>
          <p>
            Customers are responsible for sharing the correct shipping name, phone number, and
            address before the order is confirmed.
          </p>
        </section>
        <section>
          <h2>Tracking</h2>
          <p>
            Once a booking is created, customers receive a private tracking link to check the latest
            order status.
          </p>
        </section>
      </div>
    </PolicyShell>
  );
}
