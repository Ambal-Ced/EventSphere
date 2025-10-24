"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, AlertCircle, CheckCircle, Zap, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { EventCountManager } from "@/lib/event-count-manager";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";

interface EventLimits {
  eventsCreated: number;
  eventsJoined: number;
  maxEventsCreated: number;
  maxEventsJoined: number;
  planName: string;
  features: {
    fast_ai_access: boolean;
    higher_ai_priority: boolean;
  };
}

export function EventLimitsCard() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<EventLimits>({
    eventsCreated: 0,
    eventsJoined: 0,
    maxEventsCreated: 10,
    maxEventsJoined: 10,
    planName: "Free",
    features: {
      fast_ai_access: false,
      higher_ai_priority: false
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchEventLimits = async () => {
      try {
        console.log("📊 Fetching event limits for user:", user.id);

        // Ensure user has a subscription
        await DefaultSubscriptionManager.ensureUserHasSubscription(user.id);

        // Get user's current subscription
        const { data: subscription, error: subError } = await supabase
          .from("user_subscriptions")
          .select(`
            id,
            status,
            is_trial,
            trial_start,
            trial_end,
            subscription_plans (
              name
            )
          `)
          .eq("user_id", user.id)
          .single();

        if (subError) {
          console.error("❌ Error fetching subscription:", subError);
        }

        const planName = (subscription?.subscription_plans as any)?.name || "Free";
        const subscriptionFeatures = DefaultSubscriptionManager.getSubscriptionFeatures(planName);

        // Get event counts
        const counts = await EventCountManager.getEventCounts(user.id);

        console.log("📊 Event limits:", {
          eventsCreated: counts.eventsCreated,
          eventsJoined: counts.eventsJoined,
          planName,
          features: subscriptionFeatures
        });

        setLimits({
          eventsCreated: counts.eventsCreated,
          eventsJoined: counts.eventsJoined,
          maxEventsCreated: subscriptionFeatures.max_events_created === -1 ? 999 : subscriptionFeatures.max_events_created,
          maxEventsJoined: subscriptionFeatures.max_events_joined === -1 ? 999 : subscriptionFeatures.max_events_joined,
          planName,
          features: {
            fast_ai_access: subscriptionFeatures.fast_ai_access,
            higher_ai_priority: subscriptionFeatures.higher_ai_priority
          }
        });
      } catch (error) {
        console.error("❌ Error fetching event limits:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventLimits();
  }, [user]);

  // Listen for event creation events to refresh the data
  useEffect(() => {
    if (!user) return;

    const fetchEventLimits = async () => {
      try {
        console.log("📊 Fetching event limits for user:", user.id);

        // Ensure user has a subscription
        await DefaultSubscriptionManager.ensureUserHasSubscription(user.id);

        // Get user's current subscription
        const { data: subscription, error: subError } = await supabase
          .from("user_subscriptions")
          .select(`
            id,
            status,
            is_trial,
            trial_start,
            trial_end,
            subscription_plans (
              name
            )
          `)
          .eq("user_id", user.id)
          .single();

        if (subError) {
          console.error("❌ Error fetching subscription:", subError);
        }

        const planName = (subscription?.subscription_plans as any)?.name || "Free";
        const subscriptionFeatures = DefaultSubscriptionManager.getSubscriptionFeatures(planName);

        // Get event counts
        const counts = await EventCountManager.getEventCounts(user.id);

        console.log("📊 Event limits:", {
          eventsCreated: counts.eventsCreated,
          eventsJoined: counts.eventsJoined,
          planName,
          features: subscriptionFeatures
        });

        setLimits({
          eventsCreated: counts.eventsCreated,
          eventsJoined: counts.eventsJoined,
          maxEventsCreated: subscriptionFeatures.max_events_created === -1 ? 999 : subscriptionFeatures.max_events_created,
          maxEventsJoined: subscriptionFeatures.max_events_joined === -1 ? 999 : subscriptionFeatures.max_events_joined,
          planName,
          features: {
            fast_ai_access: subscriptionFeatures.fast_ai_access,
            higher_ai_priority: subscriptionFeatures.higher_ai_priority
          }
        });
      } catch (error) {
        console.error("❌ Error fetching event limits:", error);
      }
    };

    const handleEventCreated = () => {
      console.log("🔄 EventLimitsCard: Event created, refreshing limits...");
      fetchEventLimits();
    };

    // Listen for custom event creation events
    window.addEventListener('eventCreated', handleEventCreated);
    
    return () => {
      window.removeEventListener('eventCreated', handleEventCreated);
    };
  }, [user]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Event Limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const createdPercentage = (limits.eventsCreated / limits.maxEventsCreated) * 100;
  const joinedPercentage = (limits.eventsJoined / limits.maxEventsJoined) * 100;

  const isCreatedLimitReached = limits.eventsCreated >= limits.maxEventsCreated;
  const isJoinedLimitReached = limits.eventsJoined >= limits.maxEventsJoined;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Event Limits
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>Current Plan: <Badge variant="outline">{limits.planName}</Badge></span>
          {limits.features.fast_ai_access && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Fast AI
            </Badge>
          )}
          {limits.features.higher_ai_priority && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Priority AI
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Events Created */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Events Created</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant={isCreatedLimitReached ? "destructive" : "secondary"}
                className="text-xs"
              >
                {limits.maxEventsCreated === 999 ? "Unlimited" : `${limits.eventsCreated} / ${limits.maxEventsCreated}`}
              </Badge>
              {isCreatedLimitReached && limits.maxEventsCreated !== 999 && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          <Progress 
            value={createdPercentage} 
            className="h-2"
            // @ts-ignore - Progress component accepts className
            data-max={limits.maxEventsCreated}
          />
          {isCreatedLimitReached && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              You've reached your event creation limit
            </p>
          )}
        </div>

        {/* Events Joined */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Events Joined</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant={isJoinedLimitReached ? "destructive" : "secondary"}
                className="text-xs"
              >
                {limits.maxEventsJoined === 999 ? "Unlimited" : `${limits.eventsJoined} / ${limits.maxEventsJoined}`}
              </Badge>
              {isJoinedLimitReached && limits.maxEventsJoined !== 999 && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          <Progress 
            value={joinedPercentage} 
            className="h-2"
            // @ts-ignore - Progress component accepts className
            data-max={limits.maxEventsJoined}
          />
          {isJoinedLimitReached && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              You've reached your event joining limit
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Events</span>
            <Badge variant="outline">
              {limits.eventsCreated + limits.eventsJoined} / {limits.maxEventsCreated + limits.maxEventsJoined}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
