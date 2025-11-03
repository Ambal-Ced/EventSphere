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

      // Double-check: Verify user doesn't already have a subscription
      const { data: existingSubscriptions, error: checkError } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      if (checkError) {
        console.error("❌ Error checking for existing subscription:", checkError);
        return false;
      }

      if (existingSubscriptions && existingSubscriptions.length > 0) {
        console.log("⚠️ User already has subscription, skipping creation:", existingSubscriptions[0].id);
        return true; // Already has subscription, consider it successful
      }

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

      // Create default subscription (only if user has no existing subscriptions)
      const { data: subscription, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: userId,
          plan_id: freePlan.id,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 100).toISOString(), // 100 years from now (effectively no expiry)
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

      // Check if user already has ANY subscription (regardless of status)
      // Always update existing subscription, only create if user has NO subscriptions
      const { data: existingSubscriptions, error: checkError } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (checkError) {
        console.error("❌ Error checking existing subscription:", checkError);
        return false;
      }

      if (existingSubscriptions && existingSubscriptions.length > 0) {
        console.log("✅ User already has subscription:", existingSubscriptions[0].id);
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
   * Activate trial subscription (Small Event Org) - handles both new and existing subscriptions
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

      // Calculate trial end date (30 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      // Check if user already has ANY subscription (get most recent one)
      // Always update existing subscription, only create if user has NO subscriptions
      const { data: existingSubscriptions, error: checkError } = await supabase
        .from("user_subscriptions")
        .select("id, plan_id, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (checkError) {
        console.error("❌ Error checking existing subscription:", checkError);
        return false;
      }

      const existingSubscription = existingSubscriptions && existingSubscriptions.length > 0 ? existingSubscriptions[0] : null;

      if (existingSubscription) {
        // User has existing subscription - UPDATE it to Small Event Org trial
        // Update by subscription ID, not user_id, to avoid updating multiple subscriptions
        console.log("📝 User has existing subscription, updating to Small Event Org trial", {
          subscriptionId: existingSubscription.id,
          currentPlanId: existingSubscription.plan_id,
          currentStatus: existingSubscription.status
        });
        
        const { error: updateError } = await supabase
          .from("user_subscriptions")
          .update({
            plan_id: trialPlan.id,
            status: "trialing",
            current_period_start: new Date().toISOString(),
            current_period_end: trialEndDate.toISOString(),
            is_trial: true,
            trial_start: new Date().toISOString(),
            trial_end: trialEndDate.toISOString(),
            cancel_at_period_end: true, // Security: Auto-cancel at trial end
            cancelled_at: null, // Clear any cancellation
            updated_at: new Date().toISOString()
          })
          .eq("id", existingSubscription.id); // Update by subscription ID, not user_id

        if (updateError) {
          console.error("❌ Error updating existing subscription:", updateError);
          return false;
        }

        console.log("✅ Existing subscription updated to Small Event Org trial");
      } else {
        // User has no subscription - INSERT new Small Event Org trial
        console.log("📝 User has no subscription, creating new Small Event Org trial");
        
        const { error: insertError } = await supabase
          .from("user_subscriptions")
          .insert({
            user_id: userId,
            plan_id: trialPlan.id,
            status: "trialing",
            current_period_start: new Date().toISOString(),
            current_period_end: trialEndDate.toISOString(),
            is_trial: true,
            trial_start: new Date().toISOString(),
            trial_end: trialEndDate.toISOString(),
            cancel_at_period_end: true // Security: Auto-cancel at trial end
          });

        if (insertError) {
          console.error("❌ Error creating new trial subscription:", insertError);
          return false;
        }

        console.log("✅ New Small Event Org trial subscription created");
      }

      return true;
    } catch (error) {
      console.error("❌ Exception activating trial subscription:", error);
      return false;
    }
  }
}
