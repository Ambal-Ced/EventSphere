"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";

export function useEventsPageFailsafe() {
  const { user } = useAuth();
  const [showFailsafe, setShowFailsafe] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkSubscriptionAndShowIntro = async () => {
      if (!user || hasChecked) return;

      setIsChecking(true);
      setHasChecked(true);

      try {
        console.log("🔍 Events page failsafe: Checking subscription for user:", user.id);
        
        // Check if user has a subscription
        const { data: subscription, error } = await supabase
          .from("user_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error("❌ Events page failsafe: Error checking subscription:", error);
        }

        if (!subscription) {
          console.log("⚠️ Events page failsafe: No subscription found - showing failsafe popup");
          setShowFailsafe(true);
        } else {
          console.log("✅ Events page failsafe: User has subscription");
        }
      } catch (error) {
        console.error("❌ Events page failsafe: Error checking subscription:", error);
        // If there's an error, show the failsafe popup as a safety measure
        setShowFailsafe(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkSubscriptionAndShowIntro();
  }, [user, hasChecked]);

  const handleFailsafeSuccess = () => {
    setShowFailsafe(false);
    // Refresh the page to ensure all components get updated data
    window.location.reload();
  };

  const handleFailsafeClose = () => {
    setShowFailsafe(false);
  };

  return {
    showFailsafe,
    isChecking,
    handleFailsafeSuccess,
    handleFailsafeClose
  };
}
