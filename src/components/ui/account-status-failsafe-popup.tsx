"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { AccountStatusManager } from "@/lib/account-status-manager";

interface AccountStatusFailsafePopupProps {
  userId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function AccountStatusFailsafePopup({ 
  userId, 
  onSuccess, 
  onClose 
}: AccountStatusFailsafePopupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivateTrial = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("🔄 Failsafe: Creating account status for user:", userId);
      
      const success = await AccountStatusManager.addNewAccountStatus(userId);
      
      if (success) {
        console.log("✅ Failsafe: Account status created successfully");
        setIsSuccess(true);
        
        // Wait a moment to show success, then close
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        console.error("❌ Failsafe: Failed to create account status");
        setError("Failed to create account status. Please try again.");
      }
    } catch (error) {
      console.error("❌ Failsafe: Error creating account status:", error);
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
            <CardTitle className="text-green-600">Success!</CardTitle>
            <CardDescription>
              Your account status has been created successfully. You're now eligible for a 1-month free trial!
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <AlertCircle className="h-6 w-6 text-orange-600" />
          </div>
          <CardTitle className="text-orange-600">Account Setup Required</CardTitle>
          <CardDescription>
            We need to set up your account status to enable trial features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              It looks like your account status wasn't created automatically. 
              This is required to access trial features.
            </p>
            <p>
              Click the button below to set up your account and activate your 1-month free trial.
            </p>
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
              Skip for Now
            </Button>
            <Button 
              onClick={handleActivateTrial}
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Up...
                </>
              ) : (
                "Activate Trial"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
