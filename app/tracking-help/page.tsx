import { PolicyShell } from "@/components/policy-shell";

export default function TrackingHelpPage() {
  return (
    <PolicyShell
      eyebrow="Order Tracking Help"
      title="Tracking is handled through one private link."
      intro="Each confirmed booking gets a tokenized tracking URL. Customers do not need to log in."
    >
      <div className="policy-stack">
        <section>
          <h2>How it works</h2>
          <p>
            Once your order is confirmed, we create a booking and share a private URL that shows the
            latest order status.
          </p>
        </section>
        <section>
          <h2>Keep the link private</h2>
          <p>
            Anyone with the active link can view the order status page. Please avoid forwarding it
            publicly.
          </p>
        </section>
        <section>
          <h2>If the link stops working</h2>
          <p>
            Message us on Instagram. We can issue a fresh tracking link if needed.
          </p>
        </section>
      </div>
    </PolicyShell>
  );
}
