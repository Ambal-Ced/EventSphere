import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Policy & Terms - EventTria",
  description: "EventTria's policy and terms of service",
  openGraph: {
    title: "Policy & Terms - EventTria",
    description: "EventTria's policy and terms of service",
    images: [
      {
        url: "/images/template/eventtria.webp",
        width: 1200,
        height: 630,
        alt: "EventTria - Policy & Terms",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Policy & Terms - EventTria",
    description: "EventTria's policy and terms of service",
    images: ["/images/template/eventtria.webp"],
  },
};

// Force static generation - policy page doesn't change often
export const dynamic = 'force-static';
export const revalidate = false; // Never revalidate, fully static

export default function PolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-8">Terms of Service & Privacy Policy</h1>

        <h2 className="text-2xl font-semibold mt-10">1. Overview</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p>
            This summary covers the essentials of using our service: what we provide, what you
            agree to, and how your information is handled. Prices, taxes, and fees are shown before
            you pay; subscriptions auto‑renew unless cancelled; ticket refunds follow each
            organizer’s policy. We collect only the data needed to run the platform (account,
            event/ticket, check‑in, support, and limited analytics) and share it only with service
            providers, organizers (for their events), or when the law requires. You must use the
            service lawfully, protect your account, and respect others’ rights; we may suspend
            misuse. You can access, update, or delete your data where available. Details for each
            topic appear in the sections below.
          </p>
        </div>

        <h2 className="text-2xl font-semibold mt-10">2. Core Terms</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p>
            <strong>1)</strong> You agree to abide by the platform rules, community guidelines,
            and any policy updates that we may publish from time to time. You
            understand that failure to comply can result in limitations or
            removal of access.
          </p>
          <p>
            <strong>2)</strong> You consent to receive transactional communications that are
            necessary for account security, service notifications, receipts,
            and changes in policy. Marketing emails, if any, will always include
            opt‑out controls.
          </p>
          <p>
            <strong>3)</strong> You are responsible for the confidentiality of your credentials
            and for all activity that occurs under your account. Use strong
            passwords and do not share them. Promptly notify us of any suspected
            unauthorized use or security incident.
          </p>
          <p>
            <strong>4)</strong> You warrant that any content you submit is accurate, lawful,
            and that you hold the necessary rights and permissions. You agree
            not to upload content that infringes intellectual property, violates
            privacy, or contains malware, harassment, or illegal material.
          </p>
          <p>
            <strong>5)</strong> The service is provided on an "as is" and "as available" basis
            without warranties of any kind, either express or implied. We do
            not guarantee uninterrupted availability, error‑free operation, or
            that defects will be corrected.
          </p>
          <p>
            <strong>6)</strong> To the maximum extent permitted by law, our liability is limited
            to the amount you have paid for the service in the preceding twelve
            months, and we are not liable for indirect, incidental, special,
            consequential, or exemplary damages.
          </p>
          <p>
            <strong>7)</strong> By continuing, you acknowledge that you have read, understood,
            and agreed to these Terms and any referenced policies.
          </p>
        </div>

        <h2 className="text-2xl font-semibold mt-10">3. Pricing and Fees</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li><strong>Displayed prices</strong>: Prices for paid plans, tickets, or add-ons are shown in-app on the <a href="/pricing">Pricing</a> page and relevant purchase screens. Prices are in the displayed currency and may exclude applicable taxes unless noted.</li>
          <li><strong>Taxes and surcharges</strong>: Depending on your billing address and local law, taxes (e.g., VAT, GST, sales tax) and processing fees may be added at checkout and will be itemized before you confirm payment.</li>
          <li><strong>Price changes</strong>: We may update prices or introduce new fees. Changes take effect on the next billing cycle or next purchase after notice in-app or by email.</li>
          <li><strong>Promotions</strong>: Discounts and promo codes are subject to eligibility, duration, and limits as described at the time of the offer.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">4. Purchases, Billing, and Refunds</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li><strong>Payment processing</strong>: Payments are handled by our payment partners. By purchasing, you authorize charges to your selected payment method.</li>
          <li><strong>Subscriptions</strong>: If you subscribe to a plan, it renews automatically each period unless you cancel before renewal. You can manage or cancel from your account settings.</li>
          <li><strong>Ticket purchases</strong>: For event tickets, the event organizer may be the merchant of record. Organizer-specific refund and transfer policies apply and are shown at checkout.</li>
          <li><strong>Refunds</strong>: Refund eligibility depends on the product (plan vs. ticket) and the applicable policy shown at purchase. Where required by law, you may have statutory rights that are not affected by these terms.</li>
          <li><strong>Chargebacks</strong>: If you dispute a charge, we may suspend access to the related service or ticket while the dispute is investigated.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">5. Data We Collect and How We Use It</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <p>We collect the minimum data needed to provide and improve the service. The exact data depends on the feature you use:</p>
        <ul>
          <li><strong>Account registration</strong>: Email, password, basic profile details, and security signals (e.g., CAPTCHA). Used for authentication, account security, and service communications.</li>
          <li><strong>Event creation and management</strong>: Event details (title, description, schedule, venue), ticket settings, pricing, capacity, and collaborator info. Used to publish and manage events and calculate fees/taxes where applicable.</li>
          <li><strong>Ticketing and checkout</strong>: Purchaser contact info, selected tickets, billing address, and payment confirmation metadata from processors. Used to fulfill orders, receipts, fraud prevention, and compliance.</li>
          <li><strong>Attendee management and check-in</strong>: Attendee names/emails, QR codes, and check-in timestamps. Used to run entry operations, prevent duplicate entries, and generate attendance analytics.</li>
          <li><strong>Messaging and notifications</strong>: Transactional emails (receipts, reminders), and optional marketing emails with opt-out controls. Message metadata helps ensure delivery and prevent abuse.</li>
          <li><strong>Analytics and diagnostics</strong>: Aggregate usage metrics (views, sales, conversion), device and performance telemetry, and error logs. Used to improve reliability and product decisions. Analytics are reported in aggregate; we do not sell personal data.</li>
          <li><strong>Support and feedback</strong>: Support tickets, feedback forms, and related contact details. Used to resolve issues and improve features.</li>
          <li><strong>Cookies and similar technologies</strong>: Essential cookies for login/session, preference cookies, and optional analytics cookies (where allowed and with consent where required).</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">6. Data Sharing</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li><strong>Service providers</strong>: We share necessary data with vendors like payment processors, email providers, and cloud hosting under data protection agreements.</li>
          <li><strong>Organizers and attendees</strong>: If you buy a ticket, your contact details may be shared with the event organizer to fulfill the event and comply with venue/security requirements.</li>
          <li><strong>Legal and safety</strong>: We may disclose data when required by law or to protect rights, safety, or prevent fraud/abuse.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">7. Retention and Security</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li><strong>Retention</strong>: We keep data only as long as needed for the purpose collected, to comply with legal obligations, or to resolve disputes.</li>
          <li><strong>Security</strong>: We use industry-standard safeguards including encryption in transit, access controls, and monitoring. No system is 100% secure; keep your credentials confidential.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">8. Your Rights</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p>
            Depending on your location, you may have rights to access, correct, delete, or export your data, and to object to or restrict certain processing. Use in-app settings or contact us to exercise rights.
          </p>
        </div>

        <h2 className="text-2xl font-semibold mt-10">9. Acceptable Use</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>Do not misuse the platform (e.g., malware, harassment, intellectual property infringement, unlawful content).</li>
          <li>Respect event policies and applicable laws, including venue rules and local regulations.</li>
          <li>Do not attempt to circumvent security or rate limits, or scrape private data.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">10. Organizer Obligations</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>Provide accurate event information (time, location, pricing, restrictions) and update attendees promptly if details change.</li>
          <li>Comply with applicable laws, permits, venue rules, and safety requirements. You are responsible for refunds you offer.</li>
          <li>Only collect attendee data that is necessary for the event and handle it lawfully.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">11. Ticketing Terms</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>Tickets may be personal and non‑transferable unless the organizer specifies otherwise.</li>
          <li>Resale, fraud, or duplicating tickets is prohibited and may void entry without refund.</li>
          <li>Entry policies (ID checks, bag checks) are set by organizers/venues and may vary.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">12. Event Changes and Cancellations</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>Organizers may change schedules, performers, or venues. We recommend enabling notifications.</li>
          <li>For cancelled events, the organizer’s refund policy applies. We facilitate communications and payment flows where applicable.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">13. User Content and Intellectual Property</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>You retain rights in content you submit; you grant us a limited license to host and display it for service operation.</li>
          <li>Do not upload content you do not have rights to, or that infringes others’ rights.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">14. Age and Eligibility</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>You must be old enough to form a binding contract in your jurisdiction. Organizers may set additional age restrictions for events.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">15. Third‑Party Services and Links</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>We may integrate with third‑party services (payments, maps, email). Their terms and privacy policies govern your use of those services.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">16. International Data Transfers</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>Your data may be processed in countries other than your own, with appropriate safeguards where required by law.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">17. Children’s Privacy</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>Our service is not directed to children under the age where consent is required by local law. Do not register children without proper consent.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">18. Cookies and Consent</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>Essential cookies are required for login and security. Analytics/marketing cookies are optional and used with consent where required.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">19. Termination</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>We may suspend or terminate accounts that violate these terms or pose security/abuse risks. You may close your account at any time.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">20. Governing Law and Dispute Resolution</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <ul>
          <li>These terms are governed by applicable local law unless otherwise required. Disputes will be resolved in the competent courts or via arbitration if stated in your regional terms.</li>
        </ul>
        </div>

        <h2 className="text-2xl font-semibold mt-10">21. Changes to These Terms</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p>
            We may update these terms and policies. Material changes will be communicated in‑app or by email. Continued use constitutes acceptance of the updated terms.
          </p>
        </div>

        <h2 className="text-2xl font-semibold mt-10">22. Accessibility</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p>
            <strong>Accessibility Statement:</strong> The system is accessible to users with assistive needs. We are committed to ensuring that EventTria is usable by everyone, regardless of ability. Our platform is designed with accessibility in mind, following web accessibility best practices to provide an inclusive experience for all users.
          </p>
          <p>
            If you encounter any accessibility barriers while using our service, or if you need assistance accessing any features, please contact us through the support channel in your account. We will work to address your needs and improve accessibility.
          </p>
        </div>

        <h2 className="text-2xl font-semibold mt-10">23. Contact</h2>
        <div className="rounded-lg p-6 space-y-4 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p>Questions about pricing, purchases, privacy, or accessibility can be sent via the support channel in your account.</p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
