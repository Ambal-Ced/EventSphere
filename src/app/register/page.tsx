"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { format, differenceInYears } from "date-fns";
import { supabase } from "@/lib/supabase";
import HCaptcha from "@hcaptcha/react-hcaptcha";

// Use shared singleton client from lib

// Cannot export metadata from Client Component
// export const metadata: Metadata = {
//   title: "Create Account - EventSphere",
//   description: "Sign up for a new EventSphere account.",
// };

const interestsList = [
  "Music & Concerts",
  "Sports & Fitness",
  "Technology & Innovation",
  "Art & Culture",
  "Food & Cooking",
  "Travel & Adventure",
  "Business & Networking",
  "Education & Learning",
  "Gaming & Entertainment",
  "Health & Wellness",
  "Photography",
  "Fashion & Beauty",
  "Science & Research",
  "Environment & Sustainability",
  "Volunteering & Charity",
];

const rolesList = ["Attendee", "Organizer", "Volunteer", "Sponsor", "Speaker"];

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [postSignupOpen, setPostSignupOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Email is invalid";
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    if (!captchaToken) newErrors.captcha = "Please complete the captcha verification";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleDateChange = (date: Date | undefined) => {
    const age = date ? differenceInYears(new Date(), date).toString() : "";
    setFormData((prev) => ({ ...prev, birthday: date, age }));
    if (errors.birthday) {
      setErrors((prev) => ({ ...prev, birthday: "" }));
    }
  };

  // Captcha handlers
  const onCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
    if (errors.captcha) {
      setErrors((prev) => ({ ...prev, captcha: "" }));
    }
  };

  const onCaptchaExpired = () => {
    setCaptchaToken(null);
  };

  const onCaptchaError = () => {
    setCaptchaToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Open terms dialog first
    setTermsOpen(true);
  };

  const actuallySubmit = async () => {
    setTermsOpen(false);

    setIsLoading(true);
    try {
      // First, create the user account
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify-email`,
        },
      });

      if (error) {
        console.error("Sign up error:", error);
        setPostSignupOpen(true);
      } else if (data.user) {
        // Create a basic profile entry for the user
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            email: data.user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }

        // Send custom verification email using our email service
        try {
          const response = await fetch('/api/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'send_verification',
              email: formData.email,
            }),
          });

          if (!response.ok) {
            console.error('Failed to send custom verification email');
          }
        } catch (emailError) {
          console.error('Error sending custom verification email:', emailError);
        }

        setPostSignupOpen(true);
      }
    } catch (error: any) {
      console.error("Registration process error:", error);
      setPostSignupOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 py-6 sm:py-12 px-3 sm:px-4 overflow-x-hidden">
      <div className="w-full max-w-3xl rounded-lg bg-background p-4 sm:p-6 md:p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl sm:text-3xl font-bold">
          Create an account
        </h1>
        <p className="mb-6 sm:mb-8 text-center text-sm sm:text-base text-muted-foreground">
          Or{" "}
          <Link href="/login" className="text-primary hover:underline">
            sign in to your existing account
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <Label htmlFor="email" className="text-sm sm:text-base">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className={cn(errors.email && "border-destructive", "text-sm sm:text-base")}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <Label htmlFor="password" className="text-sm sm:text-base">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleInputChange}
                required
                className={cn(errors.password && "border-destructive pr-10", "pr-10")}
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
          <div>
            <Label htmlFor="confirmPassword" className="text-sm sm:text-base">Confirm Password *</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className={cn(errors.confirmPassword && "border-destructive pr-10", "pr-10")}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword((s) => !s)}
                aria-label="Toggle confirm password visibility"
              >
                {!showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Captcha */}
          <div className="overflow-x-auto">
            <div className="min-w-0 w-full">
              <HCaptcha
                ref={captchaRef}
                sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || ""}
                onVerify={onCaptchaChange}
                onExpire={onCaptchaExpired}
                onError={onCaptchaError}
                className="w-full max-w-full"
                style={{ transform: 'scale(0.8)', transformOrigin: 'left top' }}
              />
            </div>
            {errors.captcha && (
              <p className="text-xs text-destructive mt-1">{errors.captcha}</p>
            )}
          </div>

          <Button type="submit" className="w-full text-sm sm:text-base py-2 sm:py-3" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        {/* Terms & Conditions Modal */}
        <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Terms and Conditions</DialogTitle>
            </DialogHeader>
            <div className="rounded-md border bg-muted/10 p-4 max-h-96 overflow-y-auto space-y-3 text-sm text-muted-foreground">
              <p>
                Placeholder terms. This box will contain your full legal text. It is
                intentionally verbose so you can verify the scrolling behavior. Feel
                free to replace every paragraph here with your actual Terms and
                Conditions later.
              </p>
              <p>
                1) You agree to abide by the platform rules, community guidelines,
                and any policy updates that we may publish from time to time. You
                understand that failure to comply can result in limitations or
                removal of access.
              </p>
              <p>
                2) You consent to receive transactional communications that are
                necessary for account security, service notifications, receipts,
                and changes in policy. Marketing emails, if any, will always include
                opt‑out controls.
              </p>
              <p>
                3) You are responsible for the confidentiality of your credentials
                and for all activity that occurs under your account. Use strong
                passwords and do not share them. Promptly notify us of any suspected
                unauthorized use or security incident.
              </p>
              <p>
                4) You warrant that any content you submit is accurate, lawful,
                and that you hold the necessary rights and permissions. You agree
                not to upload content that infringes intellectual property, violates
                privacy, or contains malware, harassment, or illegal material.
              </p>
              <p>
                5) The service is provided on an “as is” and “as available” basis
                without warranties of any kind, either express or implied. We do
                not guarantee uninterrupted availability, error‑free operation, or
                that defects will be corrected.
              </p>
              <p>
                6) To the maximum extent permitted by law, our liability is limited
                to the amount you have paid for the service in the preceding twelve
                months, and we are not liable for indirect, incidental, special,
                consequential, or exemplary damages.
              </p>
              <p>
                7) By continuing, you acknowledge that you have read, understood,
                and agreed to these Terms and any referenced policies. These
                placeholders exist solely so you can test the UI; please replace
                them with your official legal copy before launch.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                id="agree"
                type="checkbox"
                className="h-4 w-4"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
              />
              <label htmlFor="agree" className="text-sm">
                I have read and agreed to the terms and conditions
              </label>
            </div>
            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setTermsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={actuallySubmit} disabled={!termsChecked}>
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Post-signup Modal */}
        <Dialog open={postSignupOpen} onOpenChange={setPostSignupOpen}>
          <DialogContent className="max-w-md text-center">
            <DialogHeader>
              <DialogTitle>Verify Your Email</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              An email has been sent to your address. Please verify your
              account, then sign in to continue.
            </p>
            <DialogFooter className="mt-4">
              <Button onClick={() => router.push("/login")}>OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
