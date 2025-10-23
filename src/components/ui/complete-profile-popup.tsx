"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface CompleteProfilePopupProps {
  userId: string;
  onComplete?: () => void;
}

export function CompleteProfilePopup({ userId, onComplete }: CompleteProfilePopupProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkProfileCompleteness = async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          console.error("Error checking profile:", error);
          setIsOpen(true); // Show popup if we can't check profile
          return;
        }

        const requiredFields = [
          "username",
          "fname",
          "lname",
          "address",
          "contact_no",
          "birthday",
          "gender",
        ];

        const isProfileIncomplete = !profile || requiredFields.some((field) => {
          const value = profile[field];
          return !value || value === null || value === undefined || value === "";
        });

        if (isProfileIncomplete) {
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Error in profile check:", error);
        setIsOpen(true);
      } finally {
        setIsChecking(false);
      }
    };

    if (userId) {
      checkProfileCompleteness();
    }
  }, [userId]);

  const handleCompleteProfile = () => {
    setIsOpen(false);
    router.push("/complete-profile");
    onComplete?.();
  };

  const handleSkip = () => {
    setIsOpen(false);
    onComplete?.();
  };

  if (isChecking) {
    return null; // Don't show anything while checking
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-xl font-semibold">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            To get the most out of EventTria, please complete your profile information. This helps us personalize your experience and connect you with relevant events.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-left space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Personal information</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Contact details</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Event preferences</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button onClick={handleCompleteProfile} className="w-full">
              Complete Profile
            </Button>
            <Button variant="outline" onClick={handleSkip} className="w-full">
              Skip for Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
