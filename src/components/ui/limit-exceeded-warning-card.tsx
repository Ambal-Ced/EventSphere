"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Users, Clock } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";
import { EventCountManager } from "@/lib/event-count-manager";
import { supabase } from "@/lib/supabase";

interface LimitExceededWarning {
  eventsCreated: number;
  maxEventsCreated: number;
  eventsJoined: number;
  maxEventsJoined: number;
  planName: string;
  exceededCreated: boolean;
  exceededJoined: boolean;
}

export function LimitExceededWarningCard() {
  const { user } = useAuth();
  const [warning, setWarning] = useState<LimitExceededWarning | null>(null);
  const [loading, setLoading] = useState(true);

  const checkForExceededLimits = async () => {
    if (!user) return;

    try {
      console.log("🔍 LimitExceededWarningCard: Checking for exceeded limits for user:", user.id);
      
      // Ensure user has subscription
      await DefaultSubscriptionManager.ensureUserHasSubscription(user.id);
      
      // Get user's subscription with plan details
      const { data: subscription, error: subError } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          subscription_plans (
            name
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (subError) {
        console.error("❌ LimitExceededWarningCard: Error fetching subscription:", subError);
        return;
      }

      if (!subscription) {
        console.warn("⚠️ LimitExceededWarningCard: No subscription found for user");
        return;
      }

      const planName = (subscription.subscription_plans as any)?.name || "Free Tier";
      console.log("📊 LimitExceededWarningCard: User plan:", planName);

      // Get subscription features and limits
      const subscriptionFeatures = DefaultSubscriptionManager.getSubscriptionFeatures(planName);
      const maxEventsCreated = subscriptionFeatures.max_events_created;
      const maxEventsJoined = subscriptionFeatures.max_events_joined;

      // Get current event counts
      const eventCounts = await EventCountManager.getEventCounts(user.id);
      
      console.log("📊 LimitExceededWarningCard: Event counts:", eventCounts);
      console.log("📊 LimitExceededWarningCard: Max events created:", maxEventsCreated);
      console.log("📊 LimitExceededWarningCard: Max events joined:", maxEventsJoined);

      // Check if user exceeds limits
      const exceededCreated = maxEventsCreated !== -1 && eventCounts.eventsCreated > maxEventsCreated;
      const exceededJoined = maxEventsJoined !== -1 && eventCounts.eventsJoined > maxEventsJoined;

      if (exceededCreated || exceededJoined) {
        console.warn("⚠️ LimitExceededWarningCard: User exceeds limits - showing warning");
        setWarning({
          eventsCreated: eventCounts.eventsCreated,
          maxEventsCreated: maxEventsCreated,
          eventsJoined: eventCounts.eventsJoined,
          maxEventsJoined: maxEventsJoined,
          planName: planName,
          exceededCreated: exceededCreated,
          exceededJoined: exceededJoined
        });
      } else {
        console.log("✅ LimitExceededWarningCard: User within limits - no warning needed");
        setWarning(null);
      }

    } catch (error) {
      console.error("❌ LimitExceededWarningCard: Error checking limits:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkForExceededLimits();
  }, [user]);

  // Listen for event creation events to refresh the data
  useEffect(() => {
    const handleEventCreated = () => {
      console.log("🔄 LimitExceededWarningCard: Event created, checking limits...");
      checkForExceededLimits();
    };

    // Listen for custom event creation events
    window.addEventListener('eventCreated', handleEventCreated);
    
    return () => {
      window.removeEventListener('eventCreated', handleEventCreated);
    };
  }, [user]);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!warning) {
    return null; // Don't show anything if no warning needed
  }

  const excessCreated = warning.exceededCreated ? warning.eventsCreated - warning.maxEventsCreated : 0;
  const excessJoined = warning.exceededJoined ? warning.eventsJoined - warning.maxEventsJoined : 0;

  return (
    <Card className="w-full border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
          <AlertTriangle className="h-5 w-5" />
          Subscription Limit Exceeded
        </CardTitle>
        <CardDescription className="text-orange-700 dark:text-orange-300">
          Your current {warning.planName} plan has been exceeded. Action required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Events Created Warning */}
        {warning.exceededCreated && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-red-800 dark:text-red-200">Events Created</span>
            </div>
            <div className="text-sm text-red-700 dark:text-red-300">
              <p className="mb-1">
                <strong>{warning.eventsCreated}</strong> events created (limit: {warning.maxEventsCreated})
              </p>
              <p className="font-semibold">
                ⚠️ {excessCreated} oldest event(s) will be deleted after 2 weeks
              </p>
              <p className="text-xs mt-1">
                Upgrade your plan or delete events manually to avoid data loss.
              </p>
            </div>
          </div>
        )}

        {/* Events Joined Warning */}
        {warning.exceededJoined && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-red-800 dark:text-red-200">Events Joined</span>
            </div>
            <div className="text-sm text-red-700 dark:text-red-300">
              <p className="mb-1">
                <strong>{warning.eventsJoined}</strong> events joined (limit: {warning.maxEventsJoined})
              </p>
              <p className="font-semibold">
                ⚠️ {excessJoined} oldest event(s) will be removed after 2 weeks
              </p>
              <p className="text-xs mt-1">
                Upgrade your plan or leave events manually to avoid removal.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <a 
            href="/pricing" 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg text-sm font-semibold transition-colors"
          >
            Upgrade Plan
          </a>
          <a 
            href="/my-events" 
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-center py-2 px-4 rounded-lg text-sm font-semibold transition-colors"
          >
            Manage Events
          </a>
        </div>

        {/* Timeline Notice */}
        <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <Clock className="h-4 w-4 text-yellow-600" />
          <span className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Timeline:</strong> Excess events will be automatically removed after 14 days from today.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
