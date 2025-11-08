"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

// Use shared singleton client from lib

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  useEffect(() => {
    // Always sign out the user on this page to prevent auto-login
    supabase.auth.signOut();
    try {
      const url = new URL(window.location.href);
      const next = url.searchParams.get("next");
      if (next) setNextPath(next);
    } catch {}
    
    // Load captcha token from sessionStorage
    try {
      const savedToken = sessionStorage.getItem('captcha_token_login');
      if (savedToken) {
        setCaptchaToken(savedToken);
      }
    } catch {}
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Real-time validation (text watcher)
    const newErrors: Record<string, string> = { ...errors };
    
    if (name === "email") {
      if (!value) {
        newErrors.email = "Email is required";
      } else if (!/\S+@\S+\.\S+/.test(value)) {
        newErrors.email = "Email is invalid";
      } else {
        delete newErrors.email;
      }
    }
    
    if (name === "password") {
      if (!value) {
        newErrors.password = "Password is required";
      } else {
        delete newErrors.password;
      }
    }
    
    setErrors(newErrors);
    if (error) setError(null); // Clear general error on input change
  };

  // Captcha handlers
  const onCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
    // Save to sessionStorage
    try {
      if (token) {
        sessionStorage.setItem('captcha_token_login', token);
      } else {
        sessionStorage.removeItem('captcha_token_login');
      }
    } catch {}
  };

  const onCaptchaExpired = () => {
    setCaptchaToken(null);
    // Clear from sessionStorage
    try {
      sessionStorage.removeItem('captcha_token_login');
    } catch {}
  };

  const onCaptchaError = () => {
    setCaptchaToken(null);
    // Clear from sessionStorage
    try {
      sessionStorage.removeItem('captcha_token_login');
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Check captcha
    if (!captchaToken) {
      setError("Please complete the captcha verification");
      return;
    }
    
    setIsLoading(true);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

      if (signInError) {
        console.error("Login error:", signInError);
        setError(signInError.message || "Invalid login credentials.");
      } else if (data.session) {
        console.log("Login successful!");
        // Clear captcha token from sessionStorage after successful login
        try {
          sessionStorage.removeItem('captcha_token_login');
        } catch {}
        // Check if user has a profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.session.user.id)
          .single();

        if (profileError || !profile) {
          // No profile exists, redirect to next or complete-profile
          router.push(nextPath || "/complete-profile");
        } else {
          // Profile exists, redirect to home
          router.push("/");
        }
      } else {
        // Should not happen if no error, but handle just in case
        setError("An unexpected issue occurred during login.");
      }
    } catch (err: any) {
      console.error("Login process error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 py-6 sm:py-12 px-3 sm:px-4 overflow-x-hidden">
      <div className="w-full max-w-md rounded-lg bg-background p-4 sm:p-6 md:p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl sm:text-3xl font-bold">Sign In</h1>
        <p className="mb-6 sm:mb-8 text-center text-sm sm:text-base text-muted-foreground">
          Access your EventTria account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}
          <div>
            <Label htmlFor="email" className="text-sm sm:text-base">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className={cn((error || errors.email) && "border-destructive", "text-sm sm:text-base")}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <Label htmlFor="password" className="text-sm sm:text-base">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleInputChange}
                required
                className={cn("pr-10", (error || errors.password) && "border-destructive")}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((s) => !s)}
                aria-label="Toggle password visibility"
              >
                {!showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive mt-1">{errors.password}</p>
            )}
          </div>

          {/* Captcha */}
          <div className="overflow-x-auto">
            <div className="min-w-0 w-full scale-90 sm:scale-100 origin-left">
              <HCaptcha
                ref={captchaRef}
                sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || ""}
                onVerify={onCaptchaChange}
                onExpire={onCaptchaExpired}
                onError={onCaptchaError}
              />
            </div>
          </div>

          <div className="text-right text-sm">
            <Link href="/reset" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full text-sm sm:text-base py-2 sm:py-3" disabled={isLoading}>
            {isLoading ? "Signing In..." : "Sign In"}
          </Button>
          <div className="text-center text-sm">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
