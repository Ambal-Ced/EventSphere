"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Calendar, Zap, Crown } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";
import { EventCountManager } from "@/lib/event-count-manager";
import { supabase } from "@/lib/supabase";

interface EventCreatedLimits {
  eventsCreated: number;
  maxEventsCreated: number;
  planName: string;
  features: {
    fast_ai_access: boolean;
    higher_ai_priority: boolean;
  };
}

export function EventCreatedLimitsCard() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<EventCreatedLimits>({
    eventsCreated: 0,
    maxEventsCreated: 10,
    planName: "Free Tier",
    features: {
      fast_ai_access: false,
      higher_ai_priority: false
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchEventCreatedLimits = useCallback(async () => {
    if (!user) return;

    try {
      console.log("📊 EventCreatedLimitsCard: Fetching event created limits for user:", user.id);
      
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
        console.error("❌ EventCreatedLimitsCard: Error fetching subscription:", subError);
        return;
      }

      if (!subscription) {
        console.warn("⚠️ EventCreatedLimitsCard: No subscription found for user");
        return;
      }

      const planName = (subscription.subscription_plans as any)?.name || "Free Tier";
      console.log("📊 EventCreatedLimitsCard: User plan:", planName);

      // Get subscription features and limits
      const subscriptionFeatures = DefaultSubscriptionManager.getSubscriptionFeatures(planName);
      const maxEventsCreated = subscriptionFeatures.max_events_created;

      // Get current event counts
      const eventCounts = await EventCountManager.getEventCounts(user.id);
      
      console.log("📊 EventCreatedLimitsCard: Event counts:", eventCounts);
      console.log("📊 EventCreatedLimitsCard: Max events created:", maxEventsCreated);

      setLimits({
        eventsCreated: eventCounts.eventsCreated,
        maxEventsCreated: maxEventsCreated,
        planName: planName,
        features: {
          fast_ai_access: subscriptionFeatures.fast_ai_access,
          higher_ai_priority: subscriptionFeatures.higher_ai_priority
        }
      });

    } catch (error) {
      console.error("❌ EventCreatedLimitsCard: Error fetching limits:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEventCreatedLimits();
  }, [user, fetchEventCreatedLimits]);

  // Listen for event creation and joining events to refresh the data
  useEffect(() => {
    const handleEventCreated = () => {
      console.log("🔄 EventCreatedLimitsCard: Event created, refreshing limits...");
      fetchEventCreatedLimits();
    };

    const handleEventJoined = () => {
      console.log("🔄 EventCreatedLimitsCard: Event joined, refreshing limits...");
      fetchEventCreatedLimits();
    };

    // Listen for custom event creation and joining events
    window.addEventListener('eventCreated', handleEventCreated);
    window.addEventListener('eventJoined', handleEventJoined);
    
    return () => {
      window.removeEventListener('eventCreated', handleEventCreated);
      window.removeEventListener('eventJoined', handleEventJoined);
    };
  }, [fetchEventCreatedLimits]);

  // Refresh data when component becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log("🔄 EventCreatedLimitsCard: Page became visible, refreshing limits...");
        fetchEventCreatedLimits();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchEventCreatedLimits]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Event Creation Limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = limits.maxEventsCreated === -1 ? 0 : (limits.eventsCreated / limits.maxEventsCreated) * 100;
  const isNearLimit = limits.maxEventsCreated !== -1 && limits.eventsCreated >= limits.maxEventsCreated * 0.8;
  const isAtLimit = limits.maxEventsCreated !== -1 && limits.eventsCreated >= limits.maxEventsCreated;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Event Creation Limits
        </CardTitle>
        <CardDescription>
          {limits.planName} •           {limits.features.fast_ai_access && <Badge variant="secondary" className="mr-1"><Zap className="h-3 w-3 mr-1" />Fast AI</Badge>}
          {limits.features.higher_ai_priority && <Badge variant="secondary"><Crown className="h-3 w-3 mr-1" />Priority AI</Badge>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Events Created Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Events Created</span>
            <Badge variant={isAtLimit ? "destructive" : isNearLimit ? "secondary" : "outline"}>
              {limits.eventsCreated} / {limits.maxEventsCreated === -1 ? "Unlimited" : limits.maxEventsCreated}
            </Badge>
          </div>
          
          {limits.maxEventsCreated !== -1 && (
            <Progress 
              value={usagePercentage} 
              className="h-2"
            />
          )}
          
          {limits.maxEventsCreated !== -1 && (
            <div className="text-xs text-muted-foreground">
              {limits.eventsCreated} of {limits.maxEventsCreated} events created
            </div>
          )}
        </div>

        {/* Warning Messages */}
        {isAtLimit && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">
              You've reached your event creation limit. Upgrade your plan to create more events.
            </span>
          </div>
        )}
        
        {isNearLimit && !isAtLimit && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              You're approaching your event creation limit ({limits.eventsCreated}/{limits.maxEventsCreated}).
            </span>
          </div>
        )}

        {/* Upgrade Prompt */}
        {limits.maxEventsCreated !== -1 && limits.eventsCreated >= limits.maxEventsCreated * 0.7 && (
          <div className="text-center">
            <a 
              href="/pricing" 
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Upgrade to create more events →
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
