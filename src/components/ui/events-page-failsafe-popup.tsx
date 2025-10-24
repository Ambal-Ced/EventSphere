"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";

interface EventsPageFailsafePopupProps {
  userId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function EventsPageFailsafePopup({ 
  userId, 
  onSuccess, 
  onClose 
}: EventsPageFailsafePopupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnderstand = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("🔄 Events page failsafe: Ensuring user has subscription for user:", userId);
      
      // Check and create subscription if needed
      const success = await DefaultSubscriptionManager.ensureUserHasSubscription(userId);
      
      if (success) {
        console.log("✅ Events page failsafe: Subscription ensured successfully");
        setIsSuccess(true);
        
        // Wait a moment to show success, then close
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        console.error("❌ Events page failsafe: Failed to ensure subscription");
        setError("Failed to set up your subscription. Please try again.");
      }
    } catch (error) {
      console.error("❌ Events page failsafe: Error ensuring subscription:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-green-600">All Set!</CardTitle>
            <CardDescription>
              Your subscription has been set up successfully. You can now create and join events!
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-blue-600">Welcome to Events!</CardTitle>
          <CardDescription>
            This is where you can browse, create, and join events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>What you can do here:</strong>
            </p>
            <ul className="space-y-1 ml-4">
              <li className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span>Create your own events</span>
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                <span>Join events with invite codes</span>
              </li>
              <li className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span>Track your event limits</span>
              </li>
            </ul>
          </div>
          
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Skip
            </Button>
            <Button 
              onClick={handleUnderstand}
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Up...
                </>
              ) : (
                "I Understand"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
