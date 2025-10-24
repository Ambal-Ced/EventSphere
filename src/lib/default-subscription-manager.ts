"use client";

import { supabase } from "@/lib/supabase";

export interface SubscriptionFeatures {
  ai_insights_overall: number;
  ai_insights_per_event: number;
  ai_chat: number;
  invite_people: number;
  events_created: number;
  events_joined: number;
  fast_ai_access?: boolean;
  higher_ai_priority?: boolean;
}

export interface SubscriptionLimits {
  max_ai_insights_overall: number;
  max_ai_insights_per_event: number;
  max_ai_chat: number;
  max_invite_people: number;
  max_events_created: number;
  max_events_joined: number;
  fast_ai_access: boolean;
  higher_ai_priority: boolean;
}

export class DefaultSubscriptionManager {
  /**
   * Create default free tier subscription for new user
   */
  static async createDefaultSubscription(userId: string): Promise<boolean> {
    try {
      console.log("🆕 Creating default free tier subscription for user:", userId);

      // Get the Free tier plan ID
      const { data: freePlan, error: planError } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("name", "Free")
        .single();

      if (planError || !freePlan) {
        console.error("❌ Error finding Free tier plan:", planError);
        return false;
      }

      // Create default subscription
      const { data: subscription, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: userId,
          plan_id: freePlan.id,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
          is_trial: false
        })
        .select("id")
        .single();

      if (subscriptionError) {
        console.error("❌ Error creating default subscription:", subscriptionError);
        return false;
      }

      console.log("✅ Default free tier subscription created:", subscription.id);
      return true;
    } catch (error) {
      console.error("❌ Exception creating default subscription:", error);
      return false;
    }
  }

  /**
   * Get subscription features based on plan name
   */
  static getSubscriptionFeatures(planName: string): SubscriptionLimits {
    const features: Record<string, SubscriptionLimits> = {
      "Free": {
        max_ai_insights_overall: 5,
        max_ai_insights_per_event: 5,
        max_ai_chat: 5,
        max_invite_people: 8,
        max_events_created: 10,
        max_events_joined: 10,
        fast_ai_access: false,
        higher_ai_priority: false
      },
      "Small Event Org": {
        max_ai_insights_overall: 40,
        max_ai_insights_per_event: 50,
        max_ai_chat: 30,
        max_invite_people: 30,
        max_events_created: 30,
        max_events_joined: 30,
        fast_ai_access: true,
        higher_ai_priority: false
      },
      "Large Event Org": {
        max_ai_insights_overall: 85,
        max_ai_insights_per_event: 85,
        max_ai_chat: 75,
        max_invite_people: -1, // Unlimited
        max_events_created: -1, // Unlimited
        max_events_joined: -1, // Unlimited
        fast_ai_access: true,
        higher_ai_priority: true
      }
    };

    return features[planName] || features["Free"];
  }

  /**
   * Check if user has a subscription, create default if not
   */
  static async ensureUserHasSubscription(userId: string): Promise<boolean> {
    try {
      console.log("🔍 Checking if user has subscription:", userId);

      // Check if user already has a subscription
      const { data: existingSubscription, error: checkError } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("❌ Error checking existing subscription:", checkError);
        return false;
      }

      if (existingSubscription) {
        console.log("✅ User already has subscription:", existingSubscription.id);
        return true;
      }

      // User doesn't have subscription, create default
      console.log("⚠️ User has no subscription, creating default free tier");
      return await this.createDefaultSubscription(userId);
    } catch (error) {
      console.error("❌ Exception ensuring user subscription:", error);
      return false;
    }
  }

  /**
   * Activate trial subscription (Small Event Org)
   */
  static async activateTrialSubscription(userId: string): Promise<boolean> {
    try {
      console.log("🚀 Activating trial subscription for user:", userId);

      // Get the Small Event Org plan ID
      const { data: trialPlan, error: planError } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("name", "Small Event Org")
        .single();

      if (planError || !trialPlan) {
        console.error("❌ Error finding Small Event Org plan:", planError);
        return false;
      }

      // Calculate trial end date (1 month from now)
      const trialEndDate = new Date();
      trialEndDate.setMonth(trialEndDate.getMonth() + 1);

      // Create or update trial subscription
      const { data: subscription, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: userId,
          plan_id: trialPlan.id,
          status: "trialing",
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndDate.toISOString(),
          is_trial: true,
          trial_start: new Date().toISOString(),
          trial_end: trialEndDate.toISOString()
        }, {
          onConflict: "user_id"
        })
        .select("id")
        .single();

      if (subscriptionError) {
        console.error("❌ Error creating trial subscription:", subscriptionError);
        return false;
      }

      console.log("✅ Trial subscription activated:", subscription.id);
      return true;
    } catch (error) {
      console.error("❌ Exception activating trial subscription:", error);
      return false;
    }
  }
}
