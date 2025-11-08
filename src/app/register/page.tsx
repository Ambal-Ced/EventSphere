"use client";

import { useState, useRef, useEffect } from "react";
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
//   title: "Create Account - EventTria",
//   description: "Sign up for a new EventTria account.",
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
  const [isResendScenario, setIsResendScenario] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  // Load captcha token from sessionStorage on mount
  useEffect(() => {
    try {
      const savedToken = sessionStorage.getItem('captcha_token_register');
      if (savedToken) {
        setCaptchaToken(savedToken);
      }
    } catch {}
  }, []);

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
      } else if (value.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      } else {
        delete newErrors.password;
      }
    }
    
    if (name === "confirmPassword") {
      if (!value) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== value) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }
    }
    
    setErrors(newErrors);
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
    // Save to sessionStorage
    try {
      if (token) {
        sessionStorage.setItem('captcha_token_register', token);
      } else {
        sessionStorage.removeItem('captcha_token_register');
      }
    } catch {}
    if (errors.captcha) {
      setErrors((prev) => ({ ...prev, captcha: "" }));
    }
  };

  const onCaptchaExpired = () => {
    setCaptchaToken(null);
    // Clear from sessionStorage
    try {
      sessionStorage.removeItem('captcha_token_register');
    } catch {}
  };

  const onCaptchaError = () => {
    setCaptchaToken(null);
    // Clear from sessionStorage
    try {
      sessionStorage.removeItem('captcha_token_register');
    } catch {}
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
        
        // Check if the error is due to existing unconfirmed email
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          // Try to resend confirmation email for existing unconfirmed user
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: formData.email,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/verify-email`,
            },
          });
          
          if (resendError) {
            console.error("Resend error:", resendError);
            setErrors({ email: "Failed to resend confirmation email. Please try again." });
          } else {
            // Successfully resent confirmation email
            setIsResendScenario(true);
            setPostSignupOpen(true);
          }
        } else {
          // Other signup errors - check if it's a password validation error
          const errorMessage = error.message || '';
          if (errorMessage.toLowerCase().includes('password') || 
              errorMessage.includes('Password should contain') ||
              errorMessage.includes('at least one character')) {
            // Route password validation errors to the password field
            setErrors({ password: errorMessage });
          } else {
            // Route other errors to the email field
            setErrors({ email: errorMessage });
          }
        }
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
          // Don't fail the entire registration if profile creation fails
          // The user can still verify their email and complete their profile later
          console.warn("Profile creation failed, but user can complete profile after verification");
        } else {
          console.log("Profile created successfully for user:", data.user.id);
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
        // Clear captcha token from sessionStorage after successful registration
        try {
          sessionStorage.removeItem('captcha_token_register');
        } catch {}
      }
    } catch (error: any) {
      console.error("Registration process error:", error);
      setErrors({ email: "An unexpected error occurred. Please try again." });
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
            <div className="min-w-0 w-full scale-90 sm:scale-100 origin-left">
              <HCaptcha
                ref={captchaRef}
                sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || ""}
                onVerify={onCaptchaChange}
                onExpire={onCaptchaExpired}
                onError={onCaptchaError}
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Terms of Service & Privacy Policy</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 text-sm text-muted-foreground">
              <div>
                <h3 className="text-lg font-semibold mb-3">1. Overview</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p>
                    This summary covers the essentials of using our service: what we provide, what you
                    agree to, and how your information is handled. Prices, taxes, and fees are shown before
                    you pay; subscriptions auto‑renew unless cancelled; ticket refunds follow each
                    organizer's policy. We collect only the data needed to run the platform (account,
                    event/ticket, check‑in, support, and limited analytics) and share it only with service
                    providers, organizers (for their events), or when the law requires. You must use the
                    service lawfully, protect your account, and respect others' rights; we may suspend
                    misuse. You can access, update, or delete your data where available. Details for each
                    topic appear in the sections below.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">2. Core Terms</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p><strong>1)</strong> You agree to abide by the platform rules, community guidelines,
                  and any policy updates that we may publish from time to time. You
                  understand that failure to comply can result in limitations or
                    removal of access.</p>
                  <p><strong>2)</strong> You consent to receive transactional communications that are
                  necessary for account security, service notifications, receipts,
                  and changes in policy. Marketing emails, if any, will always include
                    opt‑out controls.</p>
                  <p><strong>3)</strong> You are responsible for the confidentiality of your credentials
                  and for all activity that occurs under your account. Use strong
                  passwords and do not share them. Promptly notify us of any suspected
                    unauthorized use or security incident.</p>
                  <p><strong>4)</strong> You warrant that any content you submit is accurate, lawful,
                  and that you hold the necessary rights and permissions. You agree
                  not to upload content that infringes intellectual property, violates
                    privacy, or contains malware, harassment, or illegal material.</p>
                  <p><strong>5)</strong> The service is provided on an "as is" and "as available" basis
                  without warranties of any kind, either express or implied. We do
                  not guarantee uninterrupted availability, error‑free operation, or
                    that defects will be corrected.</p>
                  <p><strong>6)</strong> To the maximum extent permitted by law, our liability is limited
                  to the amount you have paid for the service in the preceding twelve
                  months, and we are not liable for indirect, incidental, special,
                    consequential, or exemplary damages.</p>
                  <p><strong>7)</strong> By continuing, you acknowledge that you have read, understood,
                    and agreed to these Terms and any referenced policies.</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">3. Pricing and Fees</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Displayed prices</strong>: Prices for paid plans, tickets, or add-ons are shown in-app on the <a className="underline" href="/pricing">Pricing</a> page and relevant purchase screens. Prices are in the displayed currency and may exclude applicable taxes unless noted.</li>
                    <li><strong>Taxes and surcharges</strong>: Depending on your billing address and local law, taxes (e.g., VAT, GST, sales tax) and processing fees may be added at checkout and will be itemized before you confirm payment.</li>
                    <li><strong>Price changes</strong>: We may update prices or introduce new fees. Changes take effect on the next billing cycle or next purchase after notice in-app or by email.</li>
                    <li><strong>Promotions</strong>: Discounts and promo codes are subject to eligibility, duration, and limits as described at the time of the offer.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">4. Purchases, Billing, and Refunds</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Payment processing</strong>: Payments are handled by our payment partners. By purchasing, you authorize charges to your selected payment method.</li>
                    <li><strong>Subscriptions</strong>: If you subscribe to a plan, it renews automatically each period unless you cancel before renewal. You can manage or cancel from your account settings.</li>
                    <li><strong>Ticket purchases</strong>: For event tickets, the event organizer may be the merchant of record. Organizer-specific refund and transfer policies apply and are shown at checkout.</li>
                    <li><strong>Refunds</strong>: Refund eligibility depends on the product (plan vs. ticket) and the applicable policy shown at purchase. Where required by law, you may have statutory rights that are not affected by these terms.</li>
                    <li><strong>Chargebacks</strong>: If you dispute a charge, we may suspend access to the related service or ticket while the dispute is investigated.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">5. Data We Collect and How We Use It</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p>We collect the minimum data needed to provide and improve the service. The exact data depends on the feature you use:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Account registration</strong>: Email, password, basic profile details, and security signals (e.g., CAPTCHA). Used for authentication, account security, and service communications.</li>
                    <li><strong>Event creation and management</strong>: Event details (title, description, schedule, venue), ticket settings, pricing, capacity, and collaborator info. Used to publish and manage events and calculate fees/taxes where applicable.</li>
                    <li><strong>Ticketing and checkout</strong>: Purchaser contact info, selected tickets, billing address, and payment confirmation metadata from processors. Used to fulfill orders, receipts, fraud prevention, and compliance.</li>
                    <li><strong>Attendee management and check-in</strong>: Attendee names/emails, QR codes, and check-in timestamps. Used to run entry operations, prevent duplicate entries, and generate attendance analytics.</li>
                    <li><strong>Messaging and notifications</strong>: Transactional emails (receipts, reminders), and optional marketing emails with opt-out controls. Message metadata helps ensure delivery and prevent abuse.</li>
                    <li><strong>Analytics and diagnostics</strong>: Aggregate usage metrics (views, sales, conversion), device and performance telemetry, and error logs. Used to improve reliability and product decisions. Analytics are reported in aggregate; we do not sell personal data.</li>
                    <li><strong>Support and feedback</strong>: Support tickets, feedback forms, and related contact details. Used to resolve issues and improve features.</li>
                    <li><strong>Cookies and similar technologies</strong>: Essential cookies for login/session, preference cookies, and optional analytics cookies (where allowed and with consent where required).</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">6. Data Sharing</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Service providers</strong>: We share necessary data with vendors like payment processors, email providers, and cloud hosting under data protection agreements.</li>
                    <li><strong>Organizers and attendees</strong>: If you buy a ticket, your contact details may be shared with the event organizer to fulfill the event and comply with venue/security requirements.</li>
                    <li><strong>Legal and safety</strong>: We may disclose data when required by law or to protect rights, safety, or prevent fraud/abuse.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">7. Retention and Security</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Retention</strong>: We keep data only as long as needed for the purpose collected, to comply with legal obligations, or to resolve disputes.</li>
                    <li><strong>Security</strong>: We use industry-standard safeguards including encryption in transit, access controls, and monitoring. No system is 100% secure; keep your credentials confidential.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">8. Your Rights</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p>Depending on your location, you may have rights to access, correct, delete, or export your data, and to object to or restrict certain processing. Use in-app settings or contact us to exercise rights.</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">9. Acceptable Use</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Do not misuse the platform (e.g., malware, harassment, intellectual property infringement, unlawful content).</li>
                    <li>Respect event policies and applicable laws, including venue rules and local regulations.</li>
                    <li>Do not attempt to circumvent security or rate limits, or scrape private data.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">10. Organizer Obligations</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Provide accurate event information (time, location, pricing, restrictions) and update attendees promptly if details change.</li>
                    <li>Comply with applicable laws, permits, venue rules, and safety requirements. You are responsible for refunds you offer.</li>
                    <li>Only collect attendee data that is necessary for the event and handle it lawfully.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">11. Ticketing Terms</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Tickets may be personal and non‑transferable unless the organizer specifies otherwise.</li>
                    <li>Resale, fraud, or duplicating tickets is prohibited and may void entry without refund.</li>
                    <li>Entry policies (ID checks, bag checks) are set by organizers/venues and may vary.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">12. Event Changes and Cancellations</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Organizers may change schedules, performers, or venues. We recommend enabling notifications.</li>
                    <li>For cancelled events, the organizer's refund policy applies. We facilitate communications and payment flows where applicable.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">13. User Content and Intellectual Property</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>You retain rights in content you submit; you grant us a limited license to host and display it for service operation.</li>
                    <li>Do not upload content you do not have rights to, or that infringes others' rights.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">14. Age and Eligibility</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>You must be old enough to form a binding contract in your jurisdiction. Organizers may set additional age restrictions for events.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">15. Third‑Party Services and Links</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>We may integrate with third‑party services (payments, maps, email). Their terms and privacy policies govern your use of those services.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">16. International Data Transfers</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Your data may be processed in countries other than your own, with appropriate safeguards where required by law.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">17. Children's Privacy</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Our service is not directed to children under the age where consent is required by local law. Do not register children without proper consent.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">18. Cookies and Consent</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Essential cookies are required for login and security. Analytics/marketing cookies are optional and used with consent where required.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">19. Termination</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>We may suspend or terminate accounts that violate these terms or pose security/abuse risks. You may close your account at any time.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">20. Governing Law and Dispute Resolution</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>These terms are governed by applicable local law unless otherwise required. Disputes will be resolved in the competent courts or via arbitration if stated in your regional terms.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">21. Changes to These Terms</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p>We may update these terms and policies. Material changes will be communicated in‑app or by email. Continued use constitutes acceptance of the updated terms.</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">22. Accessibility</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p>
                    <strong>Accessibility Statement:</strong> The system is accessible to users with assistive needs. We are committed to ensuring that EventTria is usable by everyone, regardless of ability. Our platform is designed with accessibility in mind, following web accessibility best practices to provide an inclusive experience for all users.
                </p>
                <p>
                    If you encounter any accessibility barriers while using our service, or if you need assistance accessing any features, please contact us through the support channel in your account. We will work to address your needs and improve accessibility.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">23. Contact</h3>
                <div className="rounded-lg p-4 space-y-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p>Questions about pricing, purchases, privacy, or accessibility can be sent via the support channel in your account.</p>
                </div>
              </div>
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
        <Dialog open={postSignupOpen} onOpenChange={(open) => {
          setPostSignupOpen(open);
          if (!open) {
            setIsResendScenario(false);
          }
        }}>
          <DialogContent className="max-w-md text-center">
            <DialogHeader>
              <DialogTitle>
                {isResendScenario ? "Confirmation Email Resent" : "Verify Your Email"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {isResendScenario 
                ? "A new confirmation email has been sent to your address. Please check your inbox and verify your account, then sign in to continue."
                : "An email has been sent to your address. Please verify your account, then sign in to continue."
              }
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
