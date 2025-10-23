"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { CompleteProfilePopup } from "@/components/ui/complete-profile-popup";

export function CompleteProfileHandler() {
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Only show popup for authenticated users
    if (user && !showPopup) {
      // Add a small delay to ensure the user is fully authenticated
      const timer = setTimeout(() => {
        setShowPopup(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, showPopup]);

  if (!user || !showPopup) {
    return null;
  }

  return (
    <CompleteProfilePopup 
      userId={user.id} 
      onComplete={() => setShowPopup(false)}
    />
  );
}
