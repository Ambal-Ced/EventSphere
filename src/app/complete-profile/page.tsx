"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
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
import { Camera } from "lucide-react";
import { User } from "@supabase/supabase-js";

// Use shared singleton client from lib

// Re-use lists from original registration form if needed
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

export default function CompleteProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    username: "",
    fname: "",
    lname: "",
    mname: "",
    suffix: "",
    address: "",
    contact_no: "",
    birthday: undefined as Date | undefined,
    age: "",
    gender: "",
    interests: [] as string[],
    role: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        // Get pending email from localStorage
        const email = localStorage.getItem("pendingVerificationEmail");
        if (email) {
          setPendingEmail(email);
          localStorage.removeItem("pendingVerificationEmail");
        }
      }
      setIsLoading(false);
    };
    getUser();
  }, [router]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.username) newErrors.username = "Username is required";
    if (!formData.fname) newErrors.fname = "First Name is required";
    if (!formData.lname) newErrors.lname = "Last Name is required";
    if (!formData.address) newErrors.address = "Address is required";
    if (!formData.contact_no)
      newErrors.contact_no = "Contact Number is required";
    if (!formData.birthday) newErrors.birthday = "Birthday is required";
    if (!formData.gender) newErrors.gender = "Gender is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    const age = date ? differenceInYears(new Date(), date).toString() : "";
    setFormData((prev) => ({ ...prev, birthday: date, age }));
  };

  const handleInterestToggle = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validate()) return;

    setIsSubmitting(true);
    try {
      const profileData = {
        id: user.id,
        username: formData.username,
        fname: formData.fname,
        lname: formData.lname,
        mname: formData.mname || null,
        suffix: formData.suffix || null,
        address: formData.address,
        contact_no: formData.contact_no,
        birthday: formData.birthday
          ? format(formData.birthday, "yyyy-MM-dd")
          : null,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        interests: formData.interests.length > 0 ? formData.interests : null,
        role: formData.role === "none" ? null : formData.role || null,
        avatar_url: avatarUrl || "/images/template/default_profile.svg",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Use upsert for insert or update in one call
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: "id" });

      if (upsertError) {
        console.error("Profile error:", upsertError);
        alert(`Failed to save profile: ${upsertError.message}`);
      } else {
        setShowSuccess(true);
      }
    } catch (err: any) {
      console.error("Error saving profile:", err);
      alert(`An unexpected error occurred: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!pendingEmail) return;
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
      });
      if (error) throw error;
      alert("Verification email sent! Please check your inbox.");
      router.push("/verify");
    } catch (error: any) {
      console.error("Error sending verification email:", error);
      alert(`Failed to send verification email: ${error.message}`);
    }
  };

  // Login handler
  const handleLoginInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });
      if (error || !data.session) {
        setLoginError(error?.message || "Login failed. Please try again.");
      } else {
        setUser(data.session.user);
      }
    } catch (err: any) {
      setLoginError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 py-12 px-4">
        <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg">
          <h1 className="text-2xl font-bold mb-4">
            Sign In to Complete Profile
          </h1>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={loginForm.email}
                onChange={handleLoginInputChange}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={loginForm.password}
                onChange={handleLoginInputChange}
                required
                autoComplete="current-password"
              />
            </div>
            {loginError && (
              <div className="text-red-500 text-sm">{loginError}</div>
            )}
            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 py-12 px-4">
        <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Profile Completed!</h1>
          <p className="mb-6 text-muted-foreground">
            Your profile has been saved successfully.
          </p>
          <Button className="w-full" onClick={() => router.push("/")}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 py-12 px-4">
      <div className="w-full max-w-3xl rounded-lg bg-background p-8 shadow-lg">
        <h1 className="mb-4 text-center text-2xl font-bold">
          Complete Your Profile
        </h1>
        <p className="mb-8 text-center text-muted-foreground">
          Please provide the following details to finish setting up your
          account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar uploader */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border">
                <AvatarImage src={previewAvatarUrl || avatarUrl || "/images/template/default_profile.svg"} />
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute -bottom-2 -right-2 rounded-full bg-primary p-2 text-primary-foreground"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload profile picture"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="w-full md:flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                Upload a profile photo or keep the default.
              </p>
              <div className="w-full">
                <Label className="mb-1 block">Upload Profile</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user) return;
                    const objectUrl = URL.createObjectURL(file);
                    setPreviewAvatarUrl(objectUrl);
                    try {
                      const { data: existing } = await supabase.storage
                        .from("avatars")
                        .list(user.id);
                      if (existing && existing.length) {
                        await supabase.storage
                          .from("avatars")
                          .remove(existing.map((f) => `${user.id}/${f.name}`));
                      }
                      const ext = file.name.split(".").pop();
                      const ts = Date.now();
                      const path = `${user.id}/avatar-${ts}.${ext}`;
                      const { error: upErr } = await supabase.storage
                        .from("avatars")
                        .upload(path, file, { cacheControl: "0", upsert: true });
                      if (upErr) throw upErr;
                      const { data } = supabase.storage
                        .from("avatars")
                        .getPublicUrl(path);
                      const url = `${data.publicUrl}?v=${ts}`;
                      setAvatarUrl(url);
                    } catch (err) {
                      console.error("Avatar upload failed:", err);
                    }
                  }}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !user) return;
                  const objectUrl = URL.createObjectURL(file);
                  setPreviewAvatarUrl(objectUrl);
                  try {
                    // Remove old files in user's folder
                    const { data: existing } = await supabase.storage
                      .from("avatars")
                      .list(user.id);
                    if (existing && existing.length) {
                      await supabase.storage
                        .from("avatars")
                        .remove(existing.map((f) => `${user.id}/${f.name}`));
                    }
                    const ext = file.name.split(".").pop();
                    const ts = Date.now();
                    const path = `${user.id}/avatar-${ts}.${ext}`;
                    const { error: upErr } = await supabase.storage
                      .from("avatars")
                      .upload(path, file, { cacheControl: "0", upsert: true });
                    if (upErr) throw upErr;
                    const { data } = supabase.storage
                      .from("avatars")
                      .getPublicUrl(path);
                    const url = `${data.publicUrl}?v=${ts}`;
                    setAvatarUrl(url);
                  } catch (err) {
                    console.error("Avatar upload failed:", err);
                  }
                }}
              />
            </div>
          </div>

          {/* Reuse form fields from the original multi-step form */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Username */}
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className={cn(errors.username && "border-destructive")}
              />
              {errors.username && (
                <p className="text-xs text-destructive mt-1">
                  {errors.username}
                </p>
              )}
            </div>
            {/* First Name */}
            <div>
              <Label htmlFor="fname">First Name *</Label>
              <Input
                id="fname"
                name="fname"
                value={formData.fname}
                onChange={handleInputChange}
                required
                className={cn(errors.fname && "border-destructive")}
              />
              {errors.fname && (
                <p className="text-xs text-destructive mt-1">{errors.fname}</p>
              )}
            </div>
            {/* Last Name */}
            <div>
              <Label htmlFor="lname">Last Name *</Label>
              <Input
                id="lname"
                name="lname"
                value={formData.lname}
                onChange={handleInputChange}
                required
                className={cn(errors.lname && "border-destructive")}
              />
              {errors.lname && (
                <p className="text-xs text-destructive mt-1">{errors.lname}</p>
              )}
            </div>
            {/* Middle Name */}
            <div>
              <Label htmlFor="mname">Middle Name</Label>
              <Input
                id="mname"
                name="mname"
                value={formData.mname}
                onChange={handleInputChange}
              />
            </div>
            {/* Suffix */}
            <div>
              <Label htmlFor="suffix">Suffix</Label>
              <Input
                id="suffix"
                name="suffix"
                value={formData.suffix}
                onChange={handleInputChange}
              />
            </div>
            {/* Address */}
            <div className="md:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                className={cn(errors.address && "border-destructive")}
              />
              {errors.address && (
                <p className="text-xs text-destructive mt-1">
                  {errors.address}
                </p>
              )}
            </div>
            {/* Contact Number */}
            <div>
              <Label htmlFor="contact_no">Contact Number *</Label>
              <Input
                id="contact_no"
                name="contact_no"
                type="tel"
                value={formData.contact_no}
                onChange={handleInputChange}
                required
                className={cn(errors.contact_no && "border-destructive")}
              />
              {errors.contact_no && (
                <p className="text-xs text-destructive mt-1">
                  {errors.contact_no}
                </p>
              )}
            </div>
            {/* Birthday */}
            <div>
              <Label htmlFor="birthday">Birthday *</Label>
              <DatePicker
                date={formData.birthday}
                setDate={handleDateChange}
                placeholder="MM/DD/YYYY"
                name="birthday"
                required
              />
              {errors.birthday && (
                <p className="text-xs text-destructive mt-1">
                  {errors.birthday}
                </p>
              )}
            </div>
            {/* Age (Read Only) */}
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                name="age"
                type="number"
                value={formData.age}
                readOnly
                className="bg-muted/50"
              />
            </div>
            {/* Gender */}
            <div>
              <Label htmlFor="gender">Gender *</Label>
              <Select
                name="gender"
                value={formData.gender}
                onValueChange={(value) => handleSelectChange("gender", value)}
                required
              >
                <SelectTrigger
                  className={cn(errors.gender && "border-destructive")}
                >
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer-not-to-say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-xs text-destructive mt-1">{errors.gender}</p>
              )}
            </div>
          </div>

          {/* Interests */}
          <div className="space-y-3">
            <Label>Select Your Interests</Label>
            <p className="text-sm text-muted-foreground">
              Choose the topics that interest you (you can select multiple)
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {interestsList.map((interest) => (
                <Button
                  key={interest}
                  type="button"
                  variant={
                    formData.interests.includes(interest)
                      ? "default"
                      : "outline"
                  }
                  onClick={() => handleInterestToggle(interest)}
                  className="justify-start text-left h-auto py-3 whitespace-normal break-words text-pretty"
                >
                  {interest}
                </Button>
              ))}
            </div>
          </div>

          {/* Role */}
          <div>
            <Label htmlFor="role">Select Role (Optional)</Label>
            <Select
              name="role"
              value={formData.role}
              onValueChange={(value) => handleSelectChange("role", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific role</SelectItem>
                {rolesList.map((role) => (
                  <SelectItem key={role} value={role.toLowerCase()}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving Profile..." : "Save Profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
