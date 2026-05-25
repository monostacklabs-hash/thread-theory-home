import type { Metadata } from "next";
import { PolicyShell } from "@/components/policy-shell";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about ordering premium bedsheets from Thread Theory Home through Instagram and tracking them online.",
  alternates: {
    canonical: "/faq"
  }
};

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I place an order?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Message Thread Theory Home on Instagram, confirm the details in DM, and the booking will be created manually."
        }
      },
      {
        "@type": "Question",
        name: "Do I need an account?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Customers do not create accounts on the website."
        }
      },
      {
        "@type": "Question",
        name: "How do I track my order?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "After confirmation, you receive a private tracking link that shows the latest order status."
        }
      },
      {
        "@type": "Question",
        name: "Do you offer refunds or exchanges?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Confirmed orders are final and non-returnable."
        }
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PolicyShell
        eyebrow="FAQ"
        title="A few things customers usually ask before ordering."
        intro="The business runs through Instagram DMs first, then the website supports tracking and trust."
      >
        <div className="policy-stack">
          <section>
            <h2>How do I place an order?</h2>
            <p>Message us on Instagram, confirm the details in DM, and we will create the booking manually.</p>
          </section>
          <section>
            <h2>Do I need an account?</h2>
            <p>No. Customers do not create accounts on this website.</p>
          </section>
          <section>
            <h2>How do I track my order?</h2>
            <p>After confirmation, you receive a private tracking link that shows the latest status.</p>
          </section>
          <section>
            <h2>Do you offer refunds or exchanges?</h2>
            <p>No. Confirmed orders are final and non-returnable.</p>
          </section>
          <section>
            <h2>Where should I ask questions?</h2>
            <p>Instagram DM is the fastest place to ask about products, timelines, and existing orders.</p>
          </section>
        </div>
      </PolicyShell>
    </>
  );
}
