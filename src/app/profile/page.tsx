"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parseISO, differenceInYears } from "date-fns";
import {
  Calendar,
  Mail,
  MapPin,
  Phone,
  UserCircle,
  Tag,
  Save,
  X,
  Upload,
  Camera,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner"; // Assuming sonner is installed
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Interface specifically for data fetched and displayed/edited on this page
interface EditableProfileData {
  username: string | null;
  fname: string | null;
  lname: string | null;
  mname: string | null;
  suffix: string | null;
  address: string | null;
  contact_no: string | null;
  birthday: string | null; // Stored as string 'yyyy-MM-dd'
  gender: string | null;
  interests: string[] | null;
  role: string | null;
  avatar_url: string | null;
  // Note: email, age, created_at, updated_at are handled separately or read-only
}

// Interface for the full profile data including read-only fields
interface FullProfileData extends EditableProfileData {
  id: string;
  email: string | null;
  age: number | null;
  created_at: string;
  updated_at: string;
}

// Add interestsList for editing
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

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FullProfileData | null>(null); // Original fetched profile
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);

  // State for editable fields, typed correctly
  const [editableProfile, setEditableProfile] = useState<EditableProfileData>({
    username: null,
    fname: null,
    lname: null,
    mname: null,
    suffix: null,
    address: null,
    contact_no: null,
    birthday: null,
    gender: null,
    interests: null,
    role: null,
    avatar_url: null,
  });
  const [birthdayDate, setBirthdayDate] = useState<Date | undefined>(undefined);

  // 1) Ensure we know the current user/session
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setIsLoading(true);
      setError(null);
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session) {
        router.push("/login");
        setIsLoading(false);
        return;
      }
      if (!cancelled) {
        setUser(session.user);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // 2) Fetch profile when we have a user id
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profileError) {
          if (profileError.code === "PGRST116") {
            setError("Profile not found. Please complete your profile.");
          } else {
            throw profileError;
          }
          if (!cancelled) setProfile(null);
        } else if (profileData) {
          if (!cancelled) {
            setProfile(profileData as FullProfileData);
            setAvatarUrl(profileData.avatar_url);
          }
        } else {
          if (!cancelled) {
            setError("Profile data is unexpectedly empty.");
            setProfile(null);
          }
        }
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        if (!cancelled) {
          setError(err.message || "An unexpected error occurred.");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // 3) Subscribe to profile changes for the current user id
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-changes-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updatedProfile = payload.new as FullProfileData;
          setProfile(updatedProfile);
          setAvatarUrl(updatedProfile?.avatar_url ?? null);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // -- Edit Mode Handlers --
  const handleEdit = () => {
    if (!profile) return;
    // Initialize editable state only with the editable fields
    setEditableProfile({
      username: profile.username,
      fname: profile.fname,
      lname: profile.lname,
      mname: profile.mname,
      suffix: profile.suffix,
      address: profile.address,
      contact_no: profile.contact_no,
      birthday: profile.birthday,
      gender: profile.gender,
      interests: profile.interests,
      role: profile.role,
      avatar_url: profile.avatar_url,
    });
    try {
      setBirthdayDate(
        profile.birthday ? parseISO(profile.birthday) : undefined
      );
    } catch (e) {
      console.error("Error parsing date for edit:", e);
      setBirthdayDate(undefined);
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset editable state, could reset to original profile values if needed
    setEditableProfile({
      username: null,
      fname: null,
      lname: null,
      mname: null,
      suffix: null,
      address: null,
      contact_no: null,
      birthday: null,
      gender: null,
      interests: null,
      role: null,
      avatar_url: null,
    });
    setBirthdayDate(undefined);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditableProfile((prev) => ({ ...prev, [name]: value || null }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setEditableProfile((prev) => ({
      ...prev,
      [name]: value === "none" ? null : value,
    }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setBirthdayDate(date);
    setEditableProfile((prev) => ({
      ...prev,
      birthday: date ? format(date, "yyyy-MM-dd") : null,
      // Age is calculated on save, not stored in editableProfile directly
    }));
  };

  const handleInterestToggle = (interest: string) => {
    const currentInterests = editableProfile.interests || [];
    const updatedInterests = currentInterests.includes(interest)
      ? currentInterests.filter((i) => i !== interest)
      : [...currentInterests, interest];
    setEditableProfile((prev) => ({
      ...prev,
      interests: updatedInterests.length > 0 ? updatedInterests : null,
    }));
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    const calculatedAge = editableProfile.birthday
      ? differenceInYears(new Date(), parseISO(editableProfile.birthday))
      : null;

    // Construct the update payload ONLY with editable fields + calculated age + updated_at
    const updateData: Partial<FullProfileData> = {
      ...editableProfile,
      age: calculatedAge,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);
      // No need to select().single() on update usually, unless you need the returned value immediately

      if (updateError) throw updateError;

      // Update the main profile state directly from the editable state + calculated age
      setProfile((prev) => ({
        ...prev!,
        ...editableProfile,
        age: calculatedAge,
        updated_at: updateData.updated_at!, // Use the timestamp we just generated
      }));

      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      console.error("Error saving profile:", err);
      toast.error(`Failed to save profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Add new handlers for avatar and email
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      // Show loading state
      toast.loading("Updating profile picture...");

      // Create a preview URL immediately
      const previewUrl = URL.createObjectURL(file);
      setPreviewAvatarUrl(previewUrl);

      // First, list and delete any existing avatars in the user's folder
      const { data: existingFiles, error: listError } = await supabase.storage
        .from("avatars")
        .list(user.id);

      if (listError) throw listError;

      // Delete existing files if any
      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
        const { error: deleteError } = await supabase.storage
          .from("avatars")
          .remove(filesToDelete);

        if (deleteError) throw deleteError;
      }

      // Upload new avatar with a timestamp to prevent caching
      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();
      const fileName = `avatar-${timestamp}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "0",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL with cache busting
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const publicUrlWithCache = `${publicUrl}?v=${timestamp}`;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrlWithCache,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Update local state
      setAvatarUrl(publicUrlWithCache);
      setEditableProfile((prev) => ({
        ...prev,
        avatar_url: publicUrlWithCache,
      }));

      // Dismiss loading toast and show success
      toast.dismiss();
      toast.success("Profile picture updated successfully!");
    } catch (err: any) {
      // Dismiss loading toast and show error
      toast.dismiss();
      console.error("Error updating avatar:", err);
      toast.error(`Failed to update profile picture: ${err.message}`);
      // Reset preview on error
      setPreviewAvatarUrl(null);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEmail) return;

    setEmailError(null);
    setIsChangingEmail(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (updateError) throw updateError;

      // Update profile email
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ email: newEmail })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast.success(
        "Email updated successfully! Please check your new email for verification."
      );
      setNewEmail("");
      setIsChangingEmail(false);
      setIsEmailDialogOpen(false);
    } catch (err: any) {
      console.error("Error updating email:", err);
      setEmailError(err.message);
      toast.error(`Failed to update email: ${err.message}`);
      setIsChangingEmail(false);
    }
  };

  // -- Render Helpers --
  const getInitials = (fname?: string | null, lname?: string | null) => {
    const first = (fname?.trim?.()[0] ?? "").toUpperCase();
    const last = (lname?.trim?.()[0] ?? "").toUpperCase();
    const initials = `${first}${last}`.trim();
    return initials || "?";
  };

  const renderTextField = (
    label: string,
    value: string | number | null | undefined
  ) => (
    <div>
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <p className="break-all whitespace-normal leading-snug">
        {value ?? (
          <span className="italic text-muted-foreground/70">Not set</span>
        )}
      </p>
    </div>
  );

  // Add cleanup function for component unmount
  useEffect(() => {
    return () => {
      // Cleanup any pending toasts when component unmounts
      toast.dismiss();
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl);
      }
    };
  }, []);

  // -- Loading/Error/No Profile States --
  if (isLoading)
    return (
      <div className="container mx-auto py-8 text-center">
        Loading profile...
      </div>
    );
  if (error)
    return (
      <div className="container mx-auto py-8 text-center text-red-600">
        Error: {error}
      </div>
    );
  if (!profile)
    return (
      <div className="container mx-auto py-8 text-center">
        Profile data could not be loaded or is incomplete.
      </div>
    );

  // -- Display Logic --
  const displayBirthday = profile.birthday
    ? format(new Date(profile.birthday + "T00:00:00"), "PPP")
    : "Not set";
  const displayFullNameString = `${profile.fname || ""} ${
    profile.mname || ""
  } ${profile.lname || ""} ${profile.suffix || ""}`.trim();
  const editableFullNameString = `${editableProfile.fname || ""} ${
    editableProfile.mname || ""
  } ${editableProfile.lname || ""} ${editableProfile.suffix || ""}`.trim();
  const headerName = isEditing
    ? editableFullNameString || "Enter Name"
    : displayFullNameString || "Name not set";
  const headerUsername = isEditing
    ? editableProfile.username || ""
    : profile.username || "username not set";

  return (
    <div className="w-full max-w-5xl mx-auto py-8 pr-3 overflow-x-hidden">
      {/* --- Header Section --- */}
      <div className="mb-8 flex flex-col items-center gap-4 md:flex-row md:items-end">
        <div className="relative">
          <Dialog
            open={isAvatarDialogOpen}
            onOpenChange={setIsAvatarDialogOpen}
          >
            <DialogTrigger asChild>
              <Avatar
                className={cn(
                  "h-24 w-24 border cursor-pointer",
                  isEditing && "hover:opacity-80 transition-opacity"
                )}
                onClick={() => !isEditing && setIsAvatarDialogOpen(true)}
              >
                <AvatarImage src={previewAvatarUrl || avatarUrl || undefined} />
                <AvatarFallback className="text-3xl">
                  {getInitials(
                    isEditing ? editableProfile.fname : profile.fname,
                    isEditing ? editableProfile.lname : profile.lname
                  )}
                </AvatarFallback>
              </Avatar>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center">Profile Picture</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-8 py-6">
                {/* Profile Picture */}
                <Avatar className="h-48 w-48">
                  <AvatarImage
                    src={previewAvatarUrl || avatarUrl || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-6xl bg-gradient-to-br from-blue-100 to-purple-100">
                    {getInitials(
                      isEditing ? editableProfile.fname : profile.fname,
                      isEditing ? editableProfile.lname : profile.lname
                    )}
                  </AvatarFallback>
                </Avatar>

                {/* Action Buttons */}
                {isEditing && (
                  <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAvatarDialogOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                      Change Picture
                  </Button>
                    <Button
                      onClick={() => {
                        setIsAvatarDialogOpen(false);
                        toast.success("Profile picture updated!");
                      }}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          {isEditing && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
              <div
                className="absolute bottom-0 right-0 rounded-full bg-primary p-2 cursor-pointer hover:bg-primary/90 transition-colors z-20"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 text-primary-foreground" />
              </div>
            </>
          )}
        </div>
        <div className="text-center md:text-left">
          <h1 className="font-bold leading-tight break-words text-[clamp(1.25rem,4vw,2.25rem)]">{headerName}</h1>
          <p className="text-muted-foreground break-all max-w-full leading-snug">@{headerUsername}</p>
          <p className="text-sm text-muted-foreground break-words whitespace-normal leading-snug">
            Joined: {format(new Date(profile.created_at), "PPP")}
          </p>
        </div>
        <div className="mt-4 flex gap-2 md:mt-0 justify-center md:justify-end">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />{" "}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button onClick={handleEdit}>Edit Profile</Button>
          )}
        </div>
      </div>

      {/* --- Main Content Grid --- */}
      <div className="grid gap-6 md:gap-8 md:grid-cols-3 w-full">
        {/* --- Contact Info Card --- */}
        <div className="rounded-lg border bg-card p-4 sm:p-6 md:col-span-1 break-words">
          <h2 className="mb-4 text-xl font-semibold">Contact Information</h2>
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="mt-1 bg-muted/50"
                    />
                    <Button variant="outline" size="icon" onClick={() => router.push("/settings")}>
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click the email icon to manage your email in Settings.
                  </p>
                </div>
                <div>
                  <Label htmlFor="contact_no">Contact Number</Label>
                  <Input
                    id="contact_no"
                    name="contact_no"
                    type="tel"
                    value={editableProfile.contact_no || ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={editableProfile.address || ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
              </>
            ) : (
              <>
                {renderTextField("Email", user?.email || profile.email)}
                {renderTextField("Contact Number", profile.contact_no)}
                {renderTextField("Address", profile.address)}
              </>
            )}
          </div>
        </div>

        {/* --- Personal Details Card --- */}
        <div className="rounded-lg border bg-card p-4 sm:p-6 md:col-span-2 break-words">
          <h2 className="mb-4 text-xl font-semibold">Personal Details</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {isEditing ? (
              <>
                <div className="sm:col-span-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    value={editableProfile.username || ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="fname">First Name</Label>
                  <Input
                    id="fname"
                    name="fname"
                    value={editableProfile.fname || ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lname">Last Name</Label>
                  <Input
                    id="lname"
                    name="lname"
                    value={editableProfile.lname || ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="mname">Middle Name</Label>
                  <Input
                    id="mname"
                    name="mname"
                    value={editableProfile.mname || ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input
                    id="suffix"
                    name="suffix"
                    value={editableProfile.suffix || ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="birthday">Birthday</Label>
                  <DatePicker
                    date={birthdayDate}
                    setDate={handleDateChange}
                    placeholder="Select birthday"
                  />
                </div>
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    name="age"
                    type="number"
                    value={
                      editableProfile.birthday
                        ? differenceInYears(
                            new Date(),
                            parseISO(editableProfile.birthday)
                          )
                        : ""
                    }
                    readOnly
                    className="mt-1 bg-muted/50"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    name="gender"
                    value={editableProfile.gender || ""}
                    onValueChange={(value) =>
                      handleSelectChange("gender", value)
                    }
                  >
                    <SelectTrigger className="mt-1">
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
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    name="role"
                    value={editableProfile.role || "none"}
                    onValueChange={(value) => handleSelectChange("role", value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific role</SelectItem>
                      <SelectItem value="attendee">Attendee</SelectItem>
                      <SelectItem value="organizer">Organizer</SelectItem>
                      <SelectItem value="volunteer">Volunteer</SelectItem>
                      <SelectItem value="sponsor">Sponsor</SelectItem>
                      <SelectItem value="speaker">Speaker</SelectItem>
                      <SelectItem value="event-organizer">Event Organizer</SelectItem>
                      <SelectItem value="event-manager">Event Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {renderTextField(
                  "Full Name",
                  displayFullNameString || "Name not set"
                )}
                {/* Username with truncate to avoid overflow */}
                <div>
                  <div className="text-sm text-muted-foreground">Username</div>
                  <div className="text-base font-medium break-words whitespace-normal leading-snug" title={profile.username || undefined}>
                    {profile.username || "—"}
                  </div>
                </div>
                {renderTextField("Birthday", displayBirthday)}
                {renderTextField("Age", profile.age)}
                {renderTextField("Gender", profile.gender)}
                {renderTextField("Role", profile.role)}
              </>
            )}
          </div>
        </div>

        {/* --- Interests Card --- */}
        <div className="rounded-lg border bg-card p-6 md:col-span-3">
          <h2 className="mb-4 text-xl font-semibold">Interests</h2>
          {isEditing ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose the topics that interest you (you can select multiple)
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {interestsList.map((interest) => (
                  <Button
                    key={interest}
                    type="button"
                    variant={
                      editableProfile.interests?.includes(interest)
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleInterestToggle(interest)}
                    className="justify-start text-left h-auto py-3"
                  >
                    {interest}
                  </Button>
                ))}
              </div>
            </div>
          ) : profile.interests && profile.interests.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <div
                  key={interest}
                  className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                >
                  {interest}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No interests specified.</p>
          )}
        </div>
      </div>
    </div>
  );
}
