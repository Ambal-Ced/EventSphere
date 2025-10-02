"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Use shared singleton client from lib

export default function VerifyPage() {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.email_confirmed_at) {
        // If email is already confirmed, redirect to login
        router.push("/login");
      } else if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    };

    checkSession();
  }, [router]);

  const handleResendEmail = async () => {
    if (!userEmail) return;

    try {
      setIsResending(true);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: userEmail,
      });

      if (error) throw error;
      setResendSuccess(true);
    } catch (error) {
      console.error("Error resending verification email:", error);
      alert("Failed to resend verification email. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 py-12 px-4">
      <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg">
        <div className="text-center">
          <h1 className="mb-4 text-3xl font-bold">Email Verification</h1>
          {userEmail ? (
            <p className="mb-2 text-muted-foreground">
              We've sent a verification link to{" "}
              <span className="font-medium text-foreground">{userEmail}</span>
            </p>
          ) : (
            <p className="mb-2 text-muted-foreground">
              We've sent a verification link to your email address.
            </p>
          )}
          <p className="mb-6 text-sm text-muted-foreground">
            Please check your inbox and click the link to verify your account.
            <br />
            Once verified, you can log in.
          </p>

          <div className="space-y-4">
            <Button
              onClick={handleResendEmail}
              disabled={isResending || resendSuccess || !userEmail}
              className="w-full"
            >
              {isResending
                ? "Resending..."
                : resendSuccess
                ? "Email Resent!"
                : "Resend Verification Email"}
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/login")}
              className="w-full"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
