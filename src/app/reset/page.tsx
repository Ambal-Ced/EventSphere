"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import HCaptcha from "@hcaptcha/react-hcaptcha";

// Use shared singleton client from lib

export default function ResetPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", username: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (error) setError(null);
  };

  // Captcha handlers
  const onCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
    if (error === "Please complete the captcha verification") {
      setError(null);
    }
  };

  const onCaptchaExpired = () => {
    setCaptchaToken(null);
  };

  const onCaptchaError = () => {
    setCaptchaToken(null);
    setError("Captcha error. Please try again.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    // Check captcha
    if (!captchaToken) {
      setError("Please complete the captcha verification");
      setIsLoading(false);
      return;
    }
    
    try {
      // Verify profile details match
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, contact_no, email")
        .eq("email", form.email)
        .eq("username", form.username)
        .eq("contact_no", form.phone)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        setError("We couldn't verify these details. Please check and try again.");
        return;
      }

      // Send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        form.email,
        { redirectTo: `${window.location.origin}/auth/password-reset-confirmation` }
      );
      if (resetError) throw resetError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to start password reset.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 py-12 px-4">
      <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg">
        <h1 className="mb-2 text-center text-3xl font-bold">Reset Password</h1>
        <p className="mb-8 text-center text-muted-foreground">
          Confirm your details and we'll send a reset link to your email.
        </p>

        {success ? (
          <>
            <div className="text-center mb-6">
              <div className="text-green-600 text-4xl mb-4">📧</div>
              <h2 className="text-xl font-semibold text-green-800 mb-2">Reset Link Sent!</h2>
              <p className="text-sm text-green-700 mb-4">
                If the information matched, a password reset link has been sent to your email.
              </p>
              <p className="text-sm text-muted-foreground">
                Please check your inbox and click the link to reset your password.
              </p>
            </div>
            <Button className="w-full" onClick={() => router.push("/login")}>Go to Login</Button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
              />
            </div>

            {/* Captcha */}
            <div>
              <HCaptcha
                ref={captchaRef}
                sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || ""}
                onVerify={onCaptchaChange}
                onExpire={onCaptchaExpired}
                onError={onCaptchaError}
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="w-1/3" onClick={() => router.push("/login")}>Cancel</Button>
              <Button type="submit" className="w-2/3" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


