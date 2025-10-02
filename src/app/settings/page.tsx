"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null); // General error for page loading

  // State for password change fields
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // State for email verification flow
  const [verificationStep, setVerificationStep] = useState<'form' | 'verify' | 'success'>('form');
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      setError(null);
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
      setIsLoading(false);
    };
    fetchUser();
  }, [router]);

  // --- Handlers for Password Change ---
  const handlePasswordInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
    if (passwordError) setPasswordError(null);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (passwords.newPassword !== passwords.confirmPassword) {
      const msg = "New passwords do not match.";
      setPasswordError(msg);
      toast.error(msg);
      return;
    }
    if (passwords.newPassword.length < 6) {
      const msg = "New password must be at least 6 characters.";
      setPasswordError(msg);
      toast.error(msg);
      return;
    }

    setIsChangingPassword(true);
    try {
      // Step 1: Send verification email
      const { error: emailError } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      });

      if (emailError) throw emailError;

      // If successful, move to verification step
      setVerificationStep('verify');
      toast.success("Verification email sent! Please check your email and enter the code.");
    } catch (err: any) {
      console.error("Error updating password:", err);
      const errMsg = err.message || "Failed to update password.";
      setPasswordError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSendVerificationCode = async () => {
    setIsSendingCode(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user?.email || '',
      });

      if (error) throw error;
      toast.success("Verification code sent to your email!");
    } catch (err: any) {
      console.error("Error sending verification code:", err);
      toast.error("Failed to send verification code. Please try again.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        token: verificationCode,
        type: 'email',
      });

      if (error) throw error;

      setVerificationStep('success');
      toast.success("Password updated successfully!");
      
      // Reset form
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setVerificationCode("");
      
      // Reset to form after 3 seconds
      setTimeout(() => {
        setVerificationStep('form');
      }, 3000);
    } catch (err: any) {
      console.error("Error verifying code:", err);
      toast.error("Invalid verification code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const resetPasswordChange = () => {
    setVerificationStep('form');
    setPasswords({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setVerificationCode("");
    setPasswordError(null);
  };

  // --- Render Logic ---
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 text-center">
        Loading settings...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 text-center">
        Please log in to view settings.
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="mb-8 text-3xl font-bold">Settings</h1>

      {error && (
        <div className="mb-6 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
          <p>
            <strong>Error:</strong> {error}
          </p>{" "}
          {/* General page error display */}
        </div>
      )}

      <div className="space-y-12">
        {/* Section 1: Change Password */}
        <section>
          <h2 className="mb-1 text-xl font-semibold">Change Password</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Update your account password. A verification code will be sent to your email.
          </p>
          
          {verificationStep === 'form' && (
            <form
              onSubmit={handlePasswordChange}
              className="space-y-6 rounded-lg border bg-card p-6"
            >
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={passwords.newPassword}
                  onChange={handlePasswordInputChange}
                  placeholder="Enter your new password"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Password must be at least 6 characters long.
                </p>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={passwords.confirmPassword}
                  onChange={handlePasswordInputChange}
                  placeholder="Confirm your new password"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? "Sending..." : "Change Password"}
                </Button>
              </div>
            </form>
          )}

          {verificationStep === 'verify' && (
            <div className="space-y-6 rounded-lg border bg-card p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Verify Your Email</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We've sent a verification code to <strong>{user?.email}</strong>
                </p>
              </div>
              
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <Label htmlFor="verificationCode">Verification Code</Label>
                  <Input
                    id="verificationCode"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                  />
                </div>
                
                <div className="flex gap-2 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetPasswordChange}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleSendVerificationCode}
                    disabled={isSendingCode}
                  >
                    {isSendingCode ? "Sending..." : "Resend Code"}
                  </Button>
                  <Button type="submit" disabled={isVerifying || verificationCode.length !== 6}>
                    {isVerifying ? "Verifying..." : "Verify & Update"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {verificationStep === 'success' && (
            <div className="space-y-6 rounded-lg border bg-green-50 border-green-200 p-6">
              <div className="text-center">
                <div className="text-green-600 text-4xl mb-4">✓</div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">Password Updated Successfully!</h3>
                <p className="text-sm text-green-700">
                  Your password has been changed. You can now use your new password to sign in.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Account Email (kept) */}
        <section>
          <h2 className="mb-1 text-xl font-semibold">Account Email</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Your email address associated with this account.
          </p>
          <div className="rounded-lg border bg-card p-6">
            <Label>Email</Label>
            <p className="text-muted-foreground">{user.email}</p>
            <Button variant="outline" size="sm" className="mt-4" disabled>
              Change Email (Not Implemented)
            </Button>
          </div>
        </section>

        {/* Removed Profile Information Section */}
        {/* Add sections for Notifications, Privacy etc. here later */}
      </div>
    </div>
  );
}
