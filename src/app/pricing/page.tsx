import { PricingClient } from "@/components/ui/pricing-client";

const pricingTiers = [
  {
    name: "Free Tier",
    price: "₱0",
    period: "forever",
    description: "Perfect for getting started with event management",
    features: [
      "5 AI insights overall",
      "5 AI insights per event",
      "5 AI chat",
      "8 invite people",
      "10 events",
      "10 joinable events"
    ],
    buttonText: "Get Started",
    buttonVariant: "outline" as const,
    popular: false,
    href: "/register",
    requiresAuth: false as const,
  },
  {
    name: "Small Event Org",
    price: "₱159",
    period: "per month",
    description: "Ideal for small to medium event organizations",
    features: [
      "40 AI insights overall",
      "50 AI insights per event",
      "30 AI chat",
      "30 invite people",
      "30 events",
      "Unlimited joinable events"
    ],
    buttonText: "Choose Plan",
    buttonVariant: "default" as const,
    popular: true,
    href: "/payment",
    requiresAuth: true as const,
  },
  {
    name: "Large Event Org",
    price: "₱300",
    period: "per month",
    description: "For large organizations with extensive event needs",
    features: [
      "85 AI insights overall",
      "85 AI insights per event",
      "75 AI chat",
      "Unlimited invite people",
      "Unlimited events",
      "Unlimited joinable events"
    ],
    buttonText: "Choose Plan",
    buttonVariant: "default" as const,
    popular: false,
    href: "/payment",
    requiresAuth: true as const,
  }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your event management needs. All plans include our core features with varying limits and capabilities.
          </p>
        </div>

        <PricingClient tiers={pricingTiers} />

        {/* FAQ Section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground">
                New users get a 1-month free trial of our Small Event Org plan after email verification. 
                Our Free Tier is permanently free for basic event management.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I change plans anytime?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens after the trial?</h3>
              <p className="text-muted-foreground">
                After your 1-month trial expires, you'll automatically move to the Free Tier unless you choose a paid plan.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-muted-foreground">
                We offer a 7-day money-back guarantee for all paid plans. Contact support for assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
