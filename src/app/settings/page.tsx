"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertTriangle, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountDeletionService } from "@/lib/account-deletion";
import { toast } from "sonner";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // State for email verification flow
  const [verificationStep, setVerificationStep] = useState<'form' | 'verify' | 'success'>('form');
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // State for email change
  const [emailChangeStep, setEmailChangeStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [newEmail, setNewEmail] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // State for account deletion
  const [deletionRequest, setDeletionRequest] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showCancelSuccessDialog, setShowCancelSuccessDialog] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [isCancellingDeletion, setIsCancellingDeletion] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");

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

  // Handle email change success
  useEffect(() => {
    if (searchParams.get('email_changed') === 'true') {
      toast.success('Email address changed successfully!');
      setEmailChangeStep('success');
      setNewEmail("");
      // Clean up URL
      router.replace('/settings');
    }
  }, [searchParams, router]);

  // Listen for auth state changes to detect email changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "TOKEN_REFRESHED" && session?.user && emailChangeStep === 'confirm') {
          // Check if the email has actually changed by comparing with the new email we set
          const currentEmail = session.user.email;
          if (currentEmail && currentEmail !== user?.email) {
            // Email change was successful
            setEmailChangeStep('success');
            toast.success('Email changed successfully!');
            setNewEmail("");
            setUser(session.user); // Update user state
          }
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [emailChangeStep, user?.email]);

  // Fetch deletion request status
  const fetchDeletionRequest = async () => {
    if (!user?.id) return;

    try {
      const request = await AccountDeletionService.getDeletionRequest(user.id);
      setDeletionRequest(request);
    } catch (error) {
      console.error('❌ Error fetching deletion request:', error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchDeletionRequest();
    }
  }, [user]);

  // Refresh deletion request status after operations
  const refreshDeletionRequest = async () => {
    if (!user?.id) return;
    try {
      const request = await AccountDeletionService.getDeletionRequest(user.id);
      setDeletionRequest(request);
    } catch (error) {
      console.error('❌ Error refreshing deletion request:', error);
    }
  };

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
      if (!user?.email) {
        throw new Error("User email not found");
      }

      // Send password reset email instead of direct update
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        user.email
      );

      if (resetError) throw resetError;

      // If successful, move to verification step
      setVerificationStep('verify');
      toast.success("Password reset link sent! Please check your email and click the link.");
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
        email: user?.email || '',
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

  // --- Handlers for Email Change ---
  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!newEmail || !user?.email) {
      setEmailError("Please enter a new email address.");
      return;
    }

    if (newEmail === user.email) {
      setEmailError("New email must be different from current email.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setIsChangingEmail(true);
    try {
      // Debug: show current session details before calling Supabase
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[EmailChange][pre]', {
        isLoggedIn: !!session?.user,
        currentEmail: user.email,
        newEmail,
        userId: session?.user?.id,
      });
      toast.message('Starting email change…', { description: `From ${user.email} to ${newEmail}` });

      // Trigger Supabase's email change confirmation flow via the client session
      const { data: updateResult, error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      }, {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation`
      });

      // Debug: log the raw result coming back from Supabase
      console.log('[EmailChange][result]', { updateResult, updateError });
      // Expose in window for quick inspection from DevTools
      // @ts-expect-error debug handle
      if (typeof window !== 'undefined') window.__EMAIL_CHANGE_DEBUG__ = { updateResult, updateError };

      if (updateError) throw updateError;

      // Inform the user what to expect based on Supabase settings
      setEmailChangeStep('confirm');
      setIsChangingEmail(false); // Reset loading state since we're now waiting for confirmation
      toast.success('Email change started. Check your email for the confirmation link.');
    } catch (err: any) {
      console.error('Error changing email:', err);
      setEmailError(err.message || 'Failed to change email. Please try again.');
      toast.error(err.message || 'Failed to change email. Please try again.');
      setIsChangingEmail(false);
    }
  };

  const resetEmailChange = () => {
    setEmailChangeStep('form');
    setNewEmail("");
    setEmailError(null);
  };

  // --- Handlers for Account Deletion ---
  const handleRequestDeletion = async () => {
    if (!user?.id || !user?.email) {
      toast.error('Unable to delete account. Please try again.');
      return;
    }

    setIsRequestingDeletion(true);
    try {
      const request = await AccountDeletionService.requestAccountDeletion(
        user.id,
        user.email,
        deletionReason || undefined
      );

      if (request) {
        // Refresh to ensure state is in sync with database
        await refreshDeletionRequest();
        setShowDeleteDialog(false);
        setDeletionReason("");
        setShowSuccessDialog(true);
      } else {
        toast.error('Failed to request account deletion. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error requesting account deletion:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!user?.id) {
      toast.error('Unable to cancel deletion. Please try again.');
      return;
    }

    setIsCancellingDeletion(true);
    try {
      const success = await AccountDeletionService.cancelDeletionRequest(user.id);

      if (success) {
        // Refresh to ensure state is in sync with database
        await refreshDeletionRequest();
        setShowCancelSuccessDialog(true);
      } else {
        toast.error('Failed to cancel deletion. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error cancelling deletion:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsCancellingDeletion(false);
    }
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
    <div className="w-full max-w-4xl mx-auto py-8 pr-3">
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
            Update your account password. A password reset link will be sent to your email.
          </p>
          
          {verificationStep === 'form' && (
            <form
              onSubmit={handlePasswordChange}
              className="space-y-6 rounded-lg border bg-card p-4 sm:p-6"
            >
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={passwords.newPassword}
                    onChange={handlePasswordInputChange}
                    placeholder="Enter your new password"
                    className="text-sm sm:text-base break-words"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
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
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwords.confirmPassword}
                    onChange={handlePasswordInputChange}
                    placeholder="Confirm your new password"
                    className="text-sm sm:text-base break-words"
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
              <div className="flex justify-end">
                <Button type="submit" disabled={isChangingPassword} className="w-full sm:w-auto">
                  {isChangingPassword ? "Sending..." : "Change Password"}
                </Button>
              </div>
            </form>
          )}

          {verificationStep === 'verify' && (
            <div className="space-y-6 rounded-lg border bg-blue-50 border-blue-200 p-6">
              <div className="text-center">
                <div className="text-blue-600 text-4xl mb-4">📧</div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Check Your Email</h3>
                <p className="text-sm text-blue-700 mb-4">
                  We've sent a password reset link to <strong>{user?.email}</strong>
                </p>
                <p className="text-sm text-blue-600 mb-4">
                  Click the link in the email to complete your password change.
                </p>
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={resetPasswordChange}
                >
                  Cancel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
              </div>
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

        {/* Section 2: Change Email */}
        <section>
          <h2 className="mb-1 text-xl font-semibold">Change Email Address</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Update your email address. A confirmation email will be sent to your new address.
          </p>
          
          {emailError && (
            <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              <p><strong>Error:</strong> {emailError}</p>
            </div>
          )}

          {emailChangeStep === 'form' && (
            <div className="space-y-6 rounded-lg border bg-card p-4 sm:p-6">
              <div>
                <Label>Current Email</Label>
                <p className="text-muted-foreground text-sm sm:text-base break-all">{user.email}</p>
              </div>
              
              <form onSubmit={handleEmailChange} className="space-y-4">
                <div>
                  <Label htmlFor="newEmail">New Email Address</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email address"
                    className="text-sm sm:text-base break-words"
                    required
                  />
                </div>
                
                <div className="flex gap-2 justify-end">
                  <Button type="submit" disabled={isChangingEmail || !newEmail} className="w-full sm:w-auto">
                    {isChangingEmail ? "Changing..." : "Change Email"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {emailChangeStep === 'confirm' && (
            <div className="space-y-6 rounded-lg border bg-blue-50 border-blue-200 p-6">
              <div className="text-center">
                <div className="text-blue-600 text-4xl mb-4">📧</div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Check Your New Email</h3>
                <p className="text-sm text-blue-700 mb-4">
                  We've sent a confirmation email to <strong>{newEmail}</strong>
                </p>
                <p className="text-sm text-blue-600">
                  Please click the confirmation link in the email to complete the email change.
                </p>
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={resetEmailChange}
                >
                  Cancel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
              </div>
            </div>
          )}

          {emailChangeStep === 'success' && (
            <div className="space-y-6 rounded-lg border bg-green-50 border-green-200 p-6">
              <div className="text-center">
                <div className="text-green-600 text-4xl mb-4">✓</div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">Email Changed Successfully!</h3>
                <p className="text-sm text-green-700">
                  Your email address has been updated to <strong>{newEmail}</strong>
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Delete Account */}
        <section>
          <h2 className="mb-1 text-xl font-semibold">Delete Account</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Request to permanently delete your account and all associated data
          </p>

          {!deletionRequest ? (
            <div className="space-y-6 rounded-lg border bg-card p-4 sm:p-6">
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-destructive">Warning: This action cannot be undone</p>
                    <ul className="space-y-1 text-xs list-disc list-inside text-muted-foreground">
                      <li>All your events will be permanently deleted</li>
                      <li>All your subscriptions and transactions will be deleted</li>
                      <li>All your usage data will be deleted</li>
                      <li>Your profile information will be deleted</li>
                      <li>Within 7 business days, an administrator will review and either approve or cancel your request</li>
                      <li>If approved, your account will be deleted at the end of the month</li>
                      <li>You can cancel your deletion request anytime before admin review</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Request Account Deletion
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 rounded-lg border bg-card p-4 sm:p-6">
              {/* Status Badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  deletionRequest.status === 'pending' 
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : deletionRequest.status === 'approved'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {deletionRequest.status === 'pending' && '⏳ Pending Review'}
                  {deletionRequest.status === 'approved' && '✓ Approved'}
                  {deletionRequest.status === 'cancelled' && '✕ Cancelled'}
                </span>
              </div>

              {deletionRequest.status === 'pending' && (
                <>
                  <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <p className="font-medium text-orange-900 dark:text-orange-200">
                          Account Deletion Requested
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-300">
                          Your deletion request is pending admin review. An administrator will review and either approve or cancel your request within 7 business days.
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-400">
                          Request submitted on: <strong>{new Date(deletionRequest.requested_at).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</strong>
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-500 mt-2">
                          If approved, your account will be deleted at the end of the month. You can cancel this request anytime before admin review.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={handleCancelDeletion}
                      disabled={isCancellingDeletion}
                      className="w-full sm:w-auto"
                    >
                      {isCancellingDeletion ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          Cancel Deletion Request
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {deletionRequest.status === 'approved' && (
                <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <p className="font-medium text-red-900 dark:text-red-200">
                        Deletion Approved
                      </p>
                      <p className="text-sm text-red-800 dark:text-red-300">
                        Your account deletion has been approved by an administrator. Your account will be permanently deleted at the end of the month.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Dialog - Deletion Request Submitted */}
          <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <div className="text-2xl">✓</div>
                  Deletion Request Submitted
                </DialogTitle>
                <DialogDescription className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Your account deletion request has been submitted successfully. An administrator will review your request within 7 business days and either approve or cancel it.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    If approved, your account will be permanently deleted at the end of the month. You can cancel your request anytime before admin review.
                  </p>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setShowSuccessDialog(false)} className="w-full sm:w-auto">
                  Got it
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Success Dialog - Deletion Request Cancelled */}
          <Dialog open={showCancelSuccessDialog} onOpenChange={setShowCancelSuccessDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <div className="text-2xl">✓</div>
                  Deletion Request Removed
                </DialogTitle>
                <DialogDescription className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Your account deletion request has been cancelled and removed from the database. Your account is safe and will not be deleted.
                  </p>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setShowCancelSuccessDialog(false)} className="w-full sm:w-auto">
                  Got it
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Request Account Deletion
                </DialogTitle>
                <DialogDescription className="space-y-3 pt-2">
                  <p className="font-medium text-foreground">
                    Are you sure you want to request account deletion?
                  </p>
                  <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 space-y-2">
                    <p className="text-sm text-destructive font-medium">
                      An administrator will review your request within 7 business days and either approve or cancel it.
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>All events will be permanently deleted</li>
                      <li>All subscriptions and transactions will be deleted</li>
                      <li>All usage data will be deleted</li>
                      <li>Your profile will be deleted</li>
                      <li>If approved, your account will be deleted at the end of the month</li>
                      <li>You can cancel your request anytime before admin review</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deletion-reason" className="text-sm font-medium">
                      Reason for deletion (optional)
                    </Label>
                    <Input
                      id="deletion-reason"
                      placeholder="Help us improve by sharing why..."
                      value={deletionReason}
                      onChange={(e) => setDeletionReason(e.target.value)}
                      className="max-w-full"
                    />
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeletionReason("");
                  }}
                  disabled={isRequestingDeletion}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRequestDeletion}
                  disabled={isRequestingDeletion}
                  className="w-full sm:w-auto"
                >
                  {isRequestingDeletion ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Confirm Deletion Request
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>

        {/* Removed Profile Information Section */}
        {/* Add sections for Notifications, Privacy etc. here later */}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Settings...</h1>
          <p className="text-muted-foreground">Please wait...</p>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
