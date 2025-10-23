import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing - EventTria",
  description: "Choose the perfect plan for your event management needs",
};

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
    href: "/register"
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
      "30 joinable events",
      "Fast AI accessibility"
    ],
    buttonText: "Choose Plan",
    buttonVariant: "default" as const,
    popular: true,
    href: "/payment?plan=small"
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
      "Unlimited joinable events",
      "Higher AI priority speed"
    ],
    buttonText: "Choose Plan",
    buttonVariant: "default" as const,
    popular: false,
    href: "/payment?plan=large"
  }
];

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Select the perfect plan for your event management needs. All plans include our core features with varying limits and capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {pricingTiers.map((tier, index) => (
          <Card 
            key={index} 
            className={`relative ${tier.popular ? 'border-primary shadow-lg scale-105' : ''}`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  Most Popular
                </div>
              </div>
            )}
            
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">{tier.name}</CardTitle>
              <CardDescription className="text-base">{tier.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-muted-foreground">/{tier.period}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                asChild 
                className="w-full" 
                variant={tier.buttonVariant}
                size="lg"
              >
                <Link href={tier.href}>
                  {tier.buttonText}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center">
        <div className="bg-muted/50 rounded-lg p-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div>
              <h3 className="font-semibold mb-2">Can I change plans anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-muted-foreground">
                We accept all major credit cards and will soon support other payment methods.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-sm text-muted-foreground">
                Our Free Tier is permanently free. Paid plans come with a 7-day free trial.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, you can cancel your subscription at any time from your billing settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
