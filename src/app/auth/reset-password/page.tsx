"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const type = searchParams.get("type");
  const [status, setStatus] = useState<'verifying' | 'form' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // Check if we have a code parameter (from password reset confirmation page)
        const code = searchParams.get("code");
        const codeType = searchParams.get("type");
        
        if (code && codeType === "recovery") {
          console.log('Recovery code detected, attempting to verify...');
          
          // Try to use the code with verifyOtp (this might work for recovery codes)
          // Note: This may require email, but let's try without first
          try {
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
              type: 'recovery',
              token_hash: code,
            });

            if (!verifyError && verifyData?.session) {
              console.log('Code verified successfully via verifyOtp');
              setStatus('form');
              setMessage('Please enter your new password.');
              return;
            }

            // If verifyOtp fails, try exchangeCodeForSession (will likely fail without verifier)
            console.warn('verifyOtp failed, trying exchangeCodeForSession...');
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (!exchangeError && exchangeData?.session) {
              console.log('Code exchanged successfully');
              setStatus('form');
              setMessage('Please enter your new password.');
              return;
            }

            // Both methods failed - code is likely expired or invalid
            console.error('Code verification failed:', verifyError || exchangeError);
            setStatus('error');
            setMessage('This password reset link has expired or is invalid. Please request a new password reset link.');
            return;
          } catch (codeError: any) {
            console.error('Error processing recovery code:', codeError);
            setStatus('error');
            setMessage('This password reset link format is not supported. Please request a new password reset link.');
            return;
          }
        }

        // Check if we have tokens in the URL fragment (Supabase's default format)
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        
        if (accessToken) {
          // Redirect to confirmation page to handle the URL fragments properly
          const currentUrl = window.location.href;
          const baseUrl = currentUrl.split('#')[0];
          const fragment = currentUrl.split('#')[1];
          
          // Redirect to confirmation page with the fragment
          router.push(`/auth/password-reset-confirmation#${fragment}`);
          return;
        }

        // Check for tokens passed from homepage via query parameters
        const tokenFromQuery = searchParams.get("token");
        const refreshFromQuery = searchParams.get("refresh");
        
        if (tokenFromQuery && refreshFromQuery) {
          console.log('Tokens received from homepage - skipping session setup');
          console.log('Going directly to password form...');
          setStatus('form');
          setMessage('Please enter your new password.');
          return;
        }

        // If the user already has an active session (e.g. after confirming the link),
        // allow them to proceed directly to the password form.
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log('Active session detected, showing password form without tokens.');
          setStatus('form');
          setMessage('Please enter your new password.');
          return;
        }

        // Fallback: check for token in query parameters
        if (token && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "recovery",
          });

          if (error) {
            console.error("Error verifying reset token:", error.message);
            setStatus('error');
            setMessage('Password reset link is invalid or has expired.');
            return;
          }

          setStatus('form');
          setMessage('Please enter your new password.');
          return;
        }

        // If no valid token found
        setStatus('error');
        setMessage('Invalid password reset link.');
      } catch (error) {
        console.error("Error during token verification:", error);
        setStatus('error');
        setMessage('An unexpected error occurred during verification.');
      }
    };

    verifyToken();
  }, [token, type, router, searchParams]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));
    if (passwordError) setPasswordError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    if (passwords.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    setIsUpdating(true);
    try {
      // If we have tokens from homepage, set the session first
      const tokenFromQuery = searchParams.get("token");
      const refreshFromQuery = searchParams.get("refresh");
      
      if (tokenFromQuery && refreshFromQuery) {
        console.log('Using direct API approach for password update...');
        
        // Try to update password using direct API call with tokens
        try {
          const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenFromQuery}`,
            },
            body: JSON.stringify({
              password: passwords.newPassword,
              refresh_token: refreshFromQuery
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update password');
          }

          const result = await response.json();
          console.log('Password updated successfully via API!');
          
          setStatus('success');
          setMessage('Your password has been successfully updated!');
          
          // Redirect to homepage after 3 seconds
          setTimeout(() => {
            router.push('/');
          }, 3000);
          return;
        } catch (apiError) {
          console.error('API password update failed:', apiError);
          throw new Error('Failed to update password. Please try requesting a new password reset link.');
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword
      });

      if (error) throw error;

      setStatus('success');
      setMessage('Your password has been successfully updated!');
      
      // Redirect to homepage after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (error: any) {
      console.error("Error updating password:", error);
      setPasswordError(error.message || "Failed to update password. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h1 className="text-2xl font-bold mb-4">Verifying reset link...</h1>
            <p className="text-muted-foreground">
              Please wait while we verify your password reset link.
            </p>
          </div>
        );
      
      case 'form':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Reset Your Password</h1>
              <p className="text-muted-foreground mb-6">
                Enter your new password below.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="newPassword">New Password *</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={passwords.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter your new password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Password must be at least 6 characters long.
                </p>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwords.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Confirm your new password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isUpdating}
              >
                {isUpdating ? "Updating Password..." : "Update Password"}
              </Button>
            </form>
          </div>
        );
      
      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <h1 className="text-2xl font-bold mb-4 text-green-800">Password Updated!</h1>
            <p className="text-muted-foreground mb-6">
              {message}
            </p>
            <Button onClick={() => router.push("/")}>
              Go to Homepage
            </Button>
          </div>
        );
      
      case 'error':
        return (
          <div className="text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
            <h1 className="text-2xl font-bold mb-4 text-red-800">Reset Failed</h1>
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

export default function ResetPasswordPage() {
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
      <ResetPasswordContent />
    </Suspense>
  );
}
