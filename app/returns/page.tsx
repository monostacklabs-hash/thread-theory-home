import { PolicyShell } from "@/components/policy-shell";

export default function ReturnsPage() {
  return (
    <PolicyShell
      eyebrow="No Refunds / Exchanges"
      title="Confirmed orders are final."
      intro="Because each order is confirmed manually after direct Instagram conversation, Thread Theory Home does not offer refunds, returns, or exchanges once an order has been confirmed."
    >
      <div className="policy-stack">
        <section>
          <h2>No refunds</h2>
          <p>We do not offer refunds on confirmed orders.</p>
        </section>
        <section>
          <h2>No exchanges</h2>
          <p>We do not offer exchanges after an order has been confirmed.</p>
        </section>
        <section>
          <h2>Please review before confirming</h2>
          <p>
            Customers should carefully review product choice, size, color, shipping details, and any
            notes before giving final confirmation in DM.
          </p>
        </section>
        <section>
          <h2>If there is an order issue</h2>
          <p>
            If you believe there is a serious issue with the order, contact us directly through
            Instagram as soon as possible so we can review the case.
          </p>
        </section>
      </div>
    </PolicyShell>
  );
}
