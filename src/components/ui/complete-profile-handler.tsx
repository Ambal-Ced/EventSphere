"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { usePathname } from "next/navigation";
import { CompleteProfilePopup } from "@/components/ui/complete-profile-popup";

export function CompleteProfileHandler() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Don't show popup if user is on complete-profile page
    if (pathname === "/complete-profile") {
      console.log("🚫 Complete profile popup blocked: User is on complete-profile page");
      return;
    }

    // Check cooldown period (2 minutes)
    const COOLDOWN_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds
    const STORAGE_KEY = "complete-profile-popup-cooldown";
    
    const lastShown = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    
    if (lastShown && (now - parseInt(lastShown)) < COOLDOWN_DURATION) {
      console.log("⏰ Complete profile popup in cooldown period");
      return;
    }

    // Only show popup for authenticated users
    if (user && !showPopup) {
      // Add a small delay to ensure the user is fully authenticated
      const timer = setTimeout(() => {
        setShowPopup(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, showPopup, pathname]);

  const handleComplete = () => {
    // Set cooldown when user interacts with popup
    const STORAGE_KEY = "complete-profile-popup-cooldown";
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    console.log("⏰ Complete profile popup cooldown set for 2 minutes");
    setShowPopup(false);
  };

  if (!user || !showPopup) {
    return null;
  }

  return (
    <CompleteProfilePopup 
      userId={user.id} 
      onComplete={handleComplete}
    />
  );
}
