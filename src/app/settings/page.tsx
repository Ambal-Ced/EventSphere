"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { type ThemePreference, useThemePreference, setThemePreference } from "@/lib/theme";

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

  const LIGHT_THEME_BG = "#E5E7EB";
  const LIGHT_THEME_TEXT = "#111827";
  const storedTheme = useThemePreference();
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>("dark");
  const [isThemeInitialized, setIsThemeInitialized] = useState(false);

  // Account deletion UI removed

  useEffect(() => {
    if (storedTheme) {
      setSelectedTheme(storedTheme);
      setIsThemeInitialized(true);
    }
  }, [storedTheme]);

  const handleThemeSelection = (theme: "light" | "dark") => {
    setSelectedTheme(theme);
    setThemePreference(theme);
  };

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

  // Account deletion effects removed

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
        user.email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/password-reset-confirmation`,
        }
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
      // Get the session and tokens to pass to the API
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const refreshToken = session?.refresh_token;
      
      // Debug: show current session details before calling API
      console.log('[EmailChange][pre]', {
        isLoggedIn: !!session?.user,
        currentEmail: user.email,
        newEmail,
        userId: session?.user?.id,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
      });
      toast.message('Starting email change…', { description: `From ${user.email} to ${newEmail}` });

      // Call the API route to send confirmation emails to both addresses
      // Note: We only send the new email - the API will get the current email from the authenticated session
      // Include credentials to ensure cookies (session) are sent, and Bearer token as fallback
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Add Bearer token if available (fallback if cookies don't work)
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      // Also send refresh token in body if available (for session setup)
      const bodyData: any = {
        action: 'email_change_confirmation',
        newEmail: newEmail,
      };
      if (refreshToken) {
        bodyData.refreshToken = refreshToken;
      }

      const response = await fetch('/api/email', {
        method: 'POST',
        headers,
        credentials: 'include', // Ensure cookies are sent with the request
        body: JSON.stringify(bodyData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Show detailed error message if available
        const errorMessage = result.details 
          ? `${result.error}: ${result.details}`
          : result.error || 'Failed to initiate email change';
        console.error('Email change API error:', result);
        throw new Error(errorMessage);
      }

      // Inform the user what to expect
      setEmailChangeStep('confirm');
      setIsChangingEmail(false); // Reset loading state since we're now waiting for confirmation
      
      if (result.warning) {
        toast.warning(result.message || 'Email change started. Please check your emails.');
      } else {
        toast.success(result.message || 'Email change started. Please check both your current and new email addresses for confirmation links.');
      }
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

  // Account deletion handlers removed

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
    <div
      className="w-full max-w-4xl mx-auto py-8 pr-3"
      style={{
        backgroundColor: selectedTheme === "light" ? LIGHT_THEME_BG : "transparent",
        color: selectedTheme === "light" ? LIGHT_THEME_TEXT : "inherit",
        transition: "background-color 0.3s ease, color 0.3s ease",
      }}
    >
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

        {/* Section 3 removed: Delete Account */}

        {/* Removed Profile Information Section */}
        {/* Add sections for Notifications, Privacy etc. here later */}

        {/* Section 3: Theme Preferences */}
        <section>
          <h2 className="mb-1 text-xl font-semibold">Theme</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Choose between light and dark mode. Theme switching will be available soon.
          </p>

          <div className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
            <div className="space-y-2">
              <label
                htmlFor="theme-light"
                className={`flex items-center justify-between rounded-md border p-4 transition hover:border-primary ${
                  selectedTheme === "light" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <div>
                  <p className="text-base font-medium">Light Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Crisp whites and bright surfaces for well-lit environments.
                  </p>
                </div>
                <input
                  id="theme-light"
                  type="radio"
                  name="theme"
                  value="light"
                  checked={selectedTheme === "light"}
                  onChange={() => handleThemeSelection("light")}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <label
                htmlFor="theme-dark"
                className={`flex items-center justify-between rounded-md border p-4 transition hover:border-primary ${
                  selectedTheme === "dark" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <div>
                  <p className="text-base font-medium">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Sleek contrast designed for night owls and low-light settings.
                  </p>
                </div>
                <input
                  id="theme-dark"
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={selectedTheme === "dark"}
                  onChange={() => handleThemeSelection("dark")}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            </div>

            <Button type="button" variant="secondary" disabled>
              Theme switching coming soon
            </Button>
          </div>
        </section>
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
