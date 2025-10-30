"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star, Gift } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { AccountStatusManager } from "@/lib/account-status-manager";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";
import { TrialActivatedPopup } from "@/components/ui/trial-activated-popup";
import { toast } from "sonner";
import { SubscriptionNotificationService } from "@/lib/subscription-notification-service";
import { useRouter } from "next/navigation";

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
  const { user } = useAuth();
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [showTrialPopup, setShowTrialPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAccountStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        console.log("🔍 Checking account status for user:", user.id);
        const isNew = await AccountStatusManager.isUserNewAccount(user.id);
        console.log("📊 Is new account:", isNew);
        setIsNewAccount(isNew);
      } catch (error) {
        console.error("❌ Error checking account status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAccountStatus();
  }, [user]);

  const handleActivateTrial = async () => {
    if (!user) return;

    setIsActivating(true);
    try {
      console.log("🚀 Activating new account trial...");
      // First, ensure user has a subscription (create default if not)
      console.log("🔍 Ensuring user has subscription...");
      const subscriptionEnsured = await DefaultSubscriptionManager.ensureUserHasSubscription(user.id);
      
      if (!subscriptionEnsured) {
        console.error("❌ Failed to ensure user subscription");
        toast.error("Failed to set up your subscription. Please try again.");
        return;
      }
      
      // Now activate the trial (this will upgrade to Small Event Org)
      const trialId = await AccountStatusManager.activateNewAccountTrial(user.id);
      
      if (trialId) {
        toast.success("🎉 30-day free trial activated! You now have access to Small Event Org features.");
        setIsNewAccount(false); // Update UI state
        setShowTrialPopup(true); // Show congratulations popup
        
        // Send notification
        await SubscriptionNotificationService.notifyTrialActivated(user.id, "Small Event Org");
        
        console.log("✅ Trial activated successfully:", trialId);
      } else {
        toast.error("Failed to activate trial. Please try again.");
        console.log("❌ Trial activation failed");
      }
    } catch (error) {
      console.error("❌ Error activating trial:", error);
      toast.error("An error occurred while activating your trial. Please try again.");
    } finally {
      setIsActivating(false);
    }
  };

  const handleTierClick = (href: string, requiresAuth: boolean) => {
    if (requiresAuth && !user) {
      router.push(`/login?redirect=${encodeURIComponent("/payment")}`);
      return;
    }
    router.push(href);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/3 mx-auto mb-4"></div>
              <div className="h-4 bg-muted rounded w-1/2 mx-auto mb-8"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        {/* New Account Trial Banner */}
        {user && isNewAccount && (
          <div className="mb-8">
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gift className="h-6 w-6 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-200">
                        Welcome! Activate Your Free Trial
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Get 30 days of free access to Small Event Org features
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleActivateTrial}
                    disabled={isActivating}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isActivating ? "Activating..." : "Activate Trial"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <Card key={index} className={`relative ${tier.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Most Popular
                  </span>
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
              
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="pt-4">
                  {tier.requiresAuth ? (
                    <Button 
                      className={`w-full`}
                      variant={tier.buttonVariant}
                      onClick={() => handleTierClick(tier.href, tier.requiresAuth)}
                    >
                      {tier.buttonText}
                    </Button>
                  ) : (
                    <Button 
                      asChild 
                      className={`w-full ${tier.buttonVariant === 'outline' ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground' : ''}`}
                      variant={tier.buttonVariant}
                    >
                      <Link href={tier.href}>{tier.buttonText}</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
      
      {/* Trial Activated Congratulations Popup */}
      <TrialActivatedPopup
        isOpen={showTrialPopup}
        onClose={() => setShowTrialPopup(false)}
      />
    </div>
  );
}