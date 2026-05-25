import { PolicyShell } from "@/components/policy-shell";

export default function ContactPage() {
  return (
    <PolicyShell
      eyebrow="Contact"
      title="The fastest way to reach us is still Instagram."
      intro="Thread Theory Home is intentionally small and conversation-led. For most questions, Instagram DM is the primary support channel."
    >
      <div className="policy-stack">
        <section>
          <h2>Instagram</h2>
          <p>
            Message us at <strong>@threadtheoryhome.in</strong> for order questions, product details,
            or support.
          </p>
        </section>
        <section>
          <h2>Order-related help</h2>
          <p>
            If you already have a tracking link, keep it ready when you message us so we can review
            the order faster.
          </p>
        </section>
      </div>
    </PolicyShell>
  );
}
