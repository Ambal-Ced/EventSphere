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
  const [status, setStatus] = useState<'verifying' | 'awaiting' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [newEmailConfirmed, setNewEmailConfirmed] = useState(false);
  const [currentEmailConfirmed, setCurrentEmailConfirmed] = useState(false);
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      // Add a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (status === 'verifying') {
          setStatus('error');
          setMessage('Verification timed out. Please try again or contact support.');
        }
      }, 10000); // 10 second timeout

      try {
        // First, check if Supabase redirected with URL hash parameters
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        console.log('Verification hash:', hash);
        
        if (hash) {
          const urlParams = new URLSearchParams(hash.substring(1));
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');
          const hashType = urlParams.get('type');
          const hashMessage = urlParams.get('message');

          console.log('Hash parameters:', { accessToken: accessToken ? 'present' : 'missing', refreshToken: refreshToken ? 'present' : 'missing', hashType, hashMessage: hashMessage ? 'present' : 'missing' });

          // Merge any prior confirmation state from localStorage
          try {
            const storedNew = typeof window !== 'undefined' ? window.localStorage.getItem('emailChange:newConfirmed') : null;
            const storedCurrent = typeof window !== 'undefined' ? window.localStorage.getItem('emailChange:currentConfirmed') : null;
            if (storedNew === '1') setNewEmailConfirmed(true);
            if (storedCurrent === '1') setCurrentEmailConfirmed(true);
          } catch {}

          // If it's the first step of email change (new email): only a message is present
          if (hashMessage && !accessToken && !refreshToken) {
            setNewEmailConfirmed(true);
            try { if (typeof window !== 'undefined') window.localStorage.setItem('emailChange:newConfirmed', '1'); } catch {}
            setStatus('awaiting');
            setMessage(hashMessage);
            clearTimeout(timeoutId);
            return;
          }

          // If tokens are present (e.g., second step or direct verify via hash), set session and proceed
          if (accessToken && refreshToken) {
            console.log('Processing tokens for session setup...');
            try {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              console.log('Session setup result:', { sessionData: sessionData ? 'success' : 'null', sessionError });

              if (sessionError) {
                console.error('Session setup error:', sessionError);
                throw sessionError;
              }

              if (hashType === 'email_change') {
                // Handle email change verification once session is established
                if (sessionData?.user) {
                  const { error: profileError } = await supabase
                    .from("profiles")
                    .update({ email: sessionData.user.email })
                    .eq("id", sessionData.user.id);

                  if (profileError) {
                    console.error("Error updating profile email:", profileError);
                    setStatus('error');
                    setMessage('Email changed but failed to update profile. Please contact support.');
                    clearTimeout(timeoutId);
                    return;
                  }

                  setCurrentEmailConfirmed(true);
                  try { if (typeof window !== 'undefined') window.localStorage.setItem('emailChange:currentConfirmed', '1'); } catch {}
                  setStatus('awaiting');
                  setMessage('Current email confirmed. Waiting for confirmation from the other email if not yet done.');
                  clearTimeout(timeoutId);
                  return;
                }
              }

              // Fallback: if not email_change, route to home or complete-profile depending on profile
              if (sessionData?.user) {
                console.log('Regular email verification - checking profile for user:', sessionData.user.id);
                
                // FORCE SHOW SUCCESS
                setStatus('success');
                setMessage('Verification successful! Your email has been verified.');
                clearTimeout(timeoutId);

                const { data: profile, error: profileError } = await supabase
                  .from("profiles")
                  .select("*")
                  .eq("id", sessionData.user.id)
                  .single();

                console.log("Hash-based profile check:", { profile: profile ? 'exists' : 'missing', profileError: profileError ? 'error' : 'none', userId: sessionData.user.id });

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
                  const value = (profile as any)[field];
                  return !value || value === null || value === undefined || value === "";
                });

                // Store redirect info but don't auto-redirect - let user see success message
                if (profileError || isProfileIncomplete) {
                  sessionStorage.setItem('verificationRedirect', '/complete-profile');
                } else {
                  sessionStorage.setItem('verificationRedirect', '/');
                }
                return;
              } else {
                console.log('No user found in session data after token setup');
                setStatus('error');
                setMessage('Verification failed. Unable to establish user session.');
                clearTimeout(timeoutId);
                return;
              }
            } catch (error) {
              console.error('Error handling hash-based verification:', error);
              setStatus('error');
              setMessage('Verification failed. The link may have expired or is invalid.');
              clearTimeout(timeoutId);
              return;
            }
          } else {
            console.log('No tokens found in hash, checking for query parameters...');
          }
        }

        // Legacy/query-based flow
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
              clearTimeout(timeoutId);
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
                clearTimeout(timeoutId);
                return;
              }

              // Handle email change verification (query-based): mirror unified flow
              if (type === "email_change") {
                const { error: profileError } = await supabase
                  .from("profiles")
                  .update({ email: session.user.email })
                  .eq("id", session.user.id);

                if (profileError) {
                  console.error("Error updating profile email:", profileError);
                  setStatus('error');
                  setMessage('Email changed but failed to update profile. Please contact support.');
                  clearTimeout(timeoutId);
                  return;
                }

                setCurrentEmailConfirmed(true);
                try { if (typeof window !== 'undefined') window.localStorage.setItem('emailChange:currentConfirmed', '1'); } catch {}
                setStatus('success');
                setMessage('Email changed successfully! Redirecting to settings...');
                
                // Redirect to settings with success parameter
                setTimeout(() => {
                  router.push('/settings?email_changed=true');
                }, 2000);
                clearTimeout(timeoutId);
                return;
              }

              // Regular email verification flow - FORCE SHOW SUCCESS
              setStatus('success');
              setMessage('Verification successful! Your email has been verified.');
              clearTimeout(timeoutId);

              // Store profile check info for later use (don't redirect automatically)
              const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .single();

              console.log("Profile check:", { profile: profile ? 'exists' : 'missing', profileError: profileError ? 'error' : 'none', userId: session.user.id });

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

              // Store redirect info but don't auto-redirect - let user see success message
              // User will click button to proceed
              if (profileError || isProfileIncomplete) {
                // Will redirect to complete-profile when user clicks button
                sessionStorage.setItem('verificationRedirect', '/complete-profile');
              } else {
                // Will redirect to home when user clicks button
                sessionStorage.setItem('verificationRedirect', '/');
              }
              return;
            }
          } catch (error) {
            console.error("Error during email verification:", error);
            setStatus('error');
            setMessage('An unexpected error occurred during verification.');
            clearTimeout(timeoutId);
            return;
          }
        } else {
          // No valid parameters found
          setStatus('error');
          setMessage('Invalid verification link. Please check your email for the correct verification link.');
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error("Unexpected error in verifyEmail:", error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
        clearTimeout(timeoutId);
      }
    };

    verifyEmail();
  }, [token, type, router, status]);

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
      case 'awaiting':
        return (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold">Confirm Email Change</h1>
            {message && (
              <p className="text-muted-foreground">{message}</p>
            )}
            <div className="grid grid-cols-1 gap-4">
              <div className={`rounded-lg border p-4 ${newEmailConfirmed ? 'border-green-300 bg-green-50' : 'border-muted'}`}>
                <p className="font-medium">New Email Confirmation</p>
                <p className="text-sm text-muted-foreground">
                  {newEmailConfirmed ? 'New email has been confirmed.' : 'Waiting for confirmation from the new email link.'}
                </p>
              </div>
              <div className={`rounded-lg border p-4 ${currentEmailConfirmed ? 'border-green-300 bg-green-50' : 'border-muted'}`}>
                <p className="font-medium">Current Email Confirmation</p>
                <p className="text-sm text-muted-foreground">
                  {currentEmailConfirmed ? 'Current email has been confirmed.' : 'Waiting for confirmation from the current email link.'}
                </p>
              </div>
            </div>
            <Button
              disabled={!(newEmailConfirmed && currentEmailConfirmed)}
              onClick={() => {
                setFinalized(true);
                setStatus('success');
                setMessage('Your email change has been confirmed.');
                try {
                  if (typeof window !== 'undefined') {
                    window.localStorage.removeItem('emailChange:newConfirmed');
                    window.localStorage.removeItem('emailChange:currentConfirmed');
                  }
                } catch {}
              }}
            >
              Finalize Email Change
            </Button>
          </div>
        );
      
      case 'success':
        const redirectPath = typeof window !== 'undefined' ? sessionStorage.getItem('verificationRedirect') || '/' : '/';
        return (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <h1 className="text-2xl font-bold mb-4 text-green-800">Verification Successful</h1>
            <p className="text-muted-foreground mb-6">
              {message || 'Your email has been verified successfully!'}
            </p>
            <Button onClick={() => {
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('verificationRedirect');
              }
              router.push(redirectPath);
            }}>
              Continue
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
