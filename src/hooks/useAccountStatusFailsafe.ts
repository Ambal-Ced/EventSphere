"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { AccountStatusManager } from "@/lib/account-status-manager";

export function useAccountStatusFailsafe() {
  const { user } = useAuth();
  const [showFailsafe, setShowFailsafe] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkAccountStatus = async () => {
      if (!user || hasChecked) return;

      setIsChecking(true);
      setHasChecked(true);

      try {
        console.log("🔍 Failsafe: Checking account status for user:", user.id);
        
        // Check if user has account status
        const isNewAccount = await AccountStatusManager.isUserNewAccount(user.id);
        
        console.log("📊 Failsafe: User new account status:", isNewAccount);
        
        // If the function returns false and we can't determine if it's because
        // the user is not new OR because there's no record, we need to check further
        // Let's use a more direct approach to check if record exists
        const accountStatus = await AccountStatusManager.getAccountStatus(user.id);
        
        if (!accountStatus) {
          console.log("⚠️ Failsafe: No account status record found - showing failsafe popup");
          setShowFailsafe(true);
        } else {
          console.log("✅ Failsafe: Account status record exists");
        }
      } catch (error) {
        console.error("❌ Failsafe: Error checking account status:", error);
        // If there's an error, show the failsafe popup as a safety measure
        setShowFailsafe(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkAccountStatus();
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
