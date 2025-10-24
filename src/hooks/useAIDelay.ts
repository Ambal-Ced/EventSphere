"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";
import { supabase } from "@/lib/supabase";

interface AIDelayConfig {
  delayMs: number;
  tierName: string;
}

export function useAIDelay() {
  const { user } = useAuth();
  const [delayConfig, setDelayConfig] = useState<AIDelayConfig>({
    delayMs: 6000, // Default to Free tier delay
    tierName: "Free Tier"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchDelayConfig = async () => {
      try {
        console.log("🤖 AI Delay: Fetching delay config for user:", user.id);
        
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
          console.error("❌ AI Delay: Error fetching subscription:", subError);
          return;
        }

        if (!subscription) {
          console.warn("⚠️ AI Delay: No subscription found for user");
          return;
        }

        const planName = (subscription.subscription_plans as any)?.name || "Free Tier";
        console.log("📊 AI Delay: User plan:", planName);

        // Set delay based on plan
        let delayMs: number;
        switch (planName) {
          case "Free Tier":
            delayMs = 6000; // 6 seconds
            break;
          case "Small Event Org":
            delayMs = 3000; // 3 seconds
            break;
          case "Large Event Org":
            delayMs = 0; // No delay
            break;
          default:
            delayMs = 6000; // Default to Free tier
        }

        console.log(`🤖 AI Delay: Set to ${delayMs}ms for ${planName}`);
        setDelayConfig({
          delayMs,
          tierName: planName
        });

      } catch (error) {
        console.error("❌ AI Delay: Error fetching delay config:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDelayConfig();
  }, [user]);

  const addAIDelay = async (): Promise<void> => {
    if (delayConfig.delayMs === 0) {
      console.log("🤖 AI Delay: No delay needed for", delayConfig.tierName);
      return;
    }

    console.log(`🤖 AI Delay: Adding ${delayConfig.delayMs}ms delay for ${delayConfig.tierName}`);
    return new Promise(resolve => {
      setTimeout(() => {
        console.log("🤖 AI Delay: Delay completed");
        resolve();
      }, delayConfig.delayMs);
    });
  };

  return {
    delayConfig,
    addAIDelay,
    loading
  };
}

