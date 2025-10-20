"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const type = searchParams.get("type");
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (token && (type === "email" || type === "email_change" || type === "recovery")) {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type === "recovery" ? "recovery" : "email",
          });

          if (error) {
            console.error("Error verifying token:", error.message);
            setStatus('error');
            setMessage('Verification failed. The link may have expired or is invalid.');
            return;
          }

          // Get the current user's session
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            // Handle password reset verification
            if (type === "recovery") {
              setStatus('success');
              setMessage('Password reset link verified! You can now reset your password.');
              
              // Redirect to reset password page after 2 seconds
              setTimeout(() => {
                router.push(`/auth/reset-password?token=${token}&type=recovery`);
              }, 2000);
              return;
            }

            // Handle email change verification
            if (type === "email_change") {
              // Update profile email if needed
              const { error: profileError } = await supabase
                .from("profiles")
                .update({ email: session.user.email })
                .eq("id", session.user.id);

              if (profileError) {
                console.error("Error updating profile email:", profileError);
                setStatus('error');
                setMessage('Email changed but failed to update profile. Please contact support.');
                return;
              }

              setStatus('success');
              setMessage('Your email address has been successfully changed!');
              
              // Redirect to settings after 3 seconds
              setTimeout(() => {
                router.push("/settings?email_changed=true");
              }, 3000);
              return;
            }

            // Regular email verification flow
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single();

            console.log("Profile check:", { profile, profileError });

            const requiredFields = [
              "username",
              "fname",
              "lname",
              "address",
              "contact_no",
              "birthday",
              "gender",
            ];

            // Check if profile exists and has all required fields
            const isProfileIncomplete = !profile || requiredFields.some((field) => {
              const value = profile[field];
              return !value || value === null || value === undefined || value === "";
            });

            console.log("Profile incomplete:", isProfileIncomplete);

            if (profileError || isProfileIncomplete) {
              console.log("Redirecting to complete-profile");
              router.push("/complete-profile");
            } else {
              console.log("Profile complete, redirecting to home");
              router.push("/");
            }
          }
        } catch (error) {
          console.error("Error during email verification:", error);
          setStatus('error');
          setMessage('An unexpected error occurred during verification.');
        }
      } else {
        setStatus('error');
        setMessage('Invalid verification link.');
      }
    };

    verifyEmail();
  }, [token, type, router]);

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h1 className="text-2xl font-bold mb-4">Verifying your email...</h1>
            <p className="text-muted-foreground">
              Please wait while we verify your email address.
            </p>
          </div>
        );
      
      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <h1 className="text-2xl font-bold mb-4 text-green-800">Email Verified!</h1>
            <p className="text-muted-foreground mb-6">
              {message}
            </p>
            <Button onClick={() => router.push("/settings")}>
              Go to Settings
            </Button>
          </div>
        );
      
      case 'error':
        return (
          <div className="text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
            <h1 className="text-2xl font-bold mb-4 text-red-800">Verification Failed</h1>
            <p className="text-muted-foreground mb-6">
              {message}
            </p>
            <div className="space-y-2">
              <Button onClick={() => router.push("/login")}>
                Go to Login
              </Button>
              <Button variant="outline" onClick={() => router.push("/settings")}>
                Go to Settings
              </Button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg">
        {renderContent()}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-muted-foreground">
            Please wait...
          </p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
