import { PolicyShell } from "@/components/policy-shell";

export default function PrivacyPage() {
  return (
    <PolicyShell
      eyebrow="Privacy Policy"
      title="We only collect what we need to confirm, manage, and track your order."
      intro="Thread Theory Home is an Instagram-first business. This website exists to support trust, order follow-up, and private tracking access."
    >
      <div className="policy-stack">
        <section>
          <h2>What we collect</h2>
          <p>
            We may collect your name, phone number, email address, shipping address, selected
            product details, order notes, and tracking-token data.
          </p>
        </section>
        <section>
          <h2>How we use it</h2>
          <p>
            We use this information to confirm orders discussed on Instagram, create bookings,
            update order status, share tracking links, and respond to support questions.
          </p>
        </section>
        <section>
          <h2>What we do not do</h2>
          <p>
            We do not create customer accounts, and we do not sell customer data. We only keep the
            information required to fulfill and manage the order.
          </p>
        </section>
        <section>
          <h2>Tracking links</h2>
          <p>
            Tracking links are private URLs generated for each booking. Customers should keep these
            links private. If a link is exposed, contact us and we can issue a new one.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            For privacy questions, message us on Instagram at `@threadtheoryhome.in` or use the
            contact details on the contact page.
          </p>
        </section>
      </div>
    </PolicyShell>
  );
}
