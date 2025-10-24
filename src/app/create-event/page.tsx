"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";
import { EventCountManager } from "@/lib/event-count-manager";
import { LoadingPopup } from "@/components/ui/loading-popup";

const categories = [
  "Technology",
  "Music",
  "Food & Drink",
  "Arts & Culture",
  "Business",
  "Gaming",
  "Health",
  "Film",
  "Sports",
  "Other",
];

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [eventData, setEventData] = useState({
    title: "",
    type: "", // Changed from category to type
    description: "",
    location: "",
    date: undefined as Date | undefined,
    is_online: false, // Added is_online field
    markup_type: "percentage" as "percentage" | "fixed",
    markup_value: 0,
    discount_type: "none" as "none" | "percentage" | "fixed",
    discount_value: 0,
  });
  const [items, setItems] = useState<{ item_name: string; item_description: string; item_quantity: number; item_cost: number; }[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [expectedAttendees, setExpectedAttendees] = useState<number>(0);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          // User not authenticated, redirect to login
          router.push('/login');
          return;
        }
        setIsAuthenticated(true);
        setAuthLoading(false);
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render the form if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Handlers for event fields
  const handleEventChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEventData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  // Handlers for items
  const handleItemChange = (
    idx: number,
    field: string,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { item_name: "", item_description: "", item_quantity: 1, item_cost: 0 },
    ]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submission started");
    console.log("Current eventData:", eventData);
    setIsSubmitting(true);

    // Validate form data
    if (!eventData.title.trim()) {
      console.log("Validation failed: Event title is required");
      toast.error("Event title is required");
      setIsSubmitting(false);
      return;
    }
    if (!eventData.type) {
      console.log("Validation failed: Event type is required");
      toast.error("Event type is required");
      setIsSubmitting(false);
      return;
    }
    console.log("Event type validation passed:", eventData.type);
    
    if (!eventData.markup_value || eventData.markup_value <= 0) {
      console.log("Validation failed: Markup value is required and must be greater than 0");
      console.log("Current markup_value:", eventData.markup_value);
      toast.error("Markup value is required and must be greater than 0");
      setIsSubmitting(false);
      return;
    }
    console.log("Markup value validation passed:", eventData.markup_value);
    if (eventData.markup_type === "percentage" && eventData.markup_value > 100) {
      toast.error("Percentage markup cannot exceed 100%");
      setIsSubmitting(false);
      return;
    }
    if (eventData.discount_type !== "none" && (!eventData.discount_value || eventData.discount_value <= 0)) {
      toast.error("Discount value is required when discount is enabled");
      setIsSubmitting(false);
      return;
    }
    if (eventData.discount_type === "percentage" && eventData.discount_value > 100) {
      console.log("Validation failed: Percentage discount cannot exceed 100%");
      toast.error("Percentage discount cannot exceed 100%");
      setIsSubmitting(false);
      return;
    }
    console.log("Discount validation passed");
    
    // Allow optional fields; only title is strictly required for minimal draft

    // Additional validation for database constraints
    if (!eventData.title.trim() || eventData.title.trim().length < 1) {
      console.log("Validation failed: Event title cannot be empty");
      toast.error("Event title cannot be empty");
      setIsSubmitting(false);
      return;
    }
    console.log("Title validation passed");

    // Optional: skip strict description check to allow empty event items/details
    console.log("All validations passed, proceeding to event creation...");

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to create an event");
      }

      // Check event creation limit
      console.log("🔍 Checking event creation limit for user:", user.id);
      try {
        // Ensure user has subscription
        await DefaultSubscriptionManager.ensureUserHasSubscription(user.id);
        
        // Get user's subscription with plan details
        const { data: subscription, error: subError } = await supabase
          .from("user_subscriptions")
          .select(`
            *,
            subscription_plans (
              name
            )
          `)
          .eq("user_id", user.id)
          .single();

        if (subError) {
          console.error("❌ Error fetching subscription:", subError);
          throw new Error("Unable to verify subscription status");
        }

        if (!subscription) {
          console.warn("⚠️ No subscription found for user");
          throw new Error("No subscription found");
        }

        const planName = (subscription.subscription_plans as any)?.name || "Free Tier";
        console.log("📊 User plan:", planName);

        // Get subscription features and limits
        const subscriptionFeatures = DefaultSubscriptionManager.getSubscriptionFeatures(planName);
        const maxEventsCreated = subscriptionFeatures.max_events_created;

        // Get current event counts
        const eventCounts = await EventCountManager.getEventCounts(user.id);
        
        console.log("📊 Current events created:", eventCounts.eventsCreated);
        console.log("📊 Max events allowed:", maxEventsCreated);

        // Check if user has reached their limit
        if (maxEventsCreated !== -1 && eventCounts.eventsCreated >= maxEventsCreated) {
          console.log("❌ User has reached event creation limit");
          toast.error(`You've reached your event creation limit (${eventCounts.eventsCreated}/${maxEventsCreated}). Upgrade your plan to create more events.`);
          setIsSubmitting(false);
          return;
        }

        console.log("✅ Event creation limit check passed");
      } catch (limitError: any) {
        console.error("❌ Error checking event creation limit:", limitError);
        toast.error("Unable to verify event creation limits. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // 0. Prepare image URL (upload if provided; else upload template to user's folder)
      let imageUrl: string | null = null;
      try {
        const fileToUpload: File | Blob | null = imageFile
          ? imageFile
          : await (async () => {
              const res = await fetch("/images/template/event_template.webp");
              if (!res.ok) return null;
              const blob = await res.blob();
              return new File([blob], "event_template.webp", {
                type: blob.type,
              });
            })();

        if (fileToUpload) {
          const fileExt =
            (fileToUpload as File).name?.split(".").pop() || "jpg";
          const path = `${user.id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("event-images")
            .upload(path, fileToUpload, { upsert: true });
          if (!uploadError) {
            const { data: publicData } = supabase.storage
              .from("event-images")
              .getPublicUrl(path);
            imageUrl = publicData?.publicUrl || null;
          } else {
            console.warn("Event image upload failed:", uploadError.message);
            toast.message("Image upload skipped", {
              description: uploadError.message,
            });
          }
        }
      } catch (imgErr: any) {
        console.warn("Image preparation failed:", imgErr?.message);
        // Continue without blocking event creation
      }

      // 1. Insert event using your schema (user_id, category, is_public)
      const insertPayload: any = {
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        date: eventData.date ? eventData.date.toISOString() : null,
        image_url: imageUrl,
        category: eventData.type, // Use 'category' to match database schema
        is_public: eventData.is_online, // Use 'is_public' to match database schema
        user_id: user.id, // Use 'user_id' to match database schema
        owner_id: user.id, // Add owner_id since it's required in your schema
        status: "coming_soon", // Add status since column exists
        role: "owner", // Add role since column exists
        markup_type: eventData.markup_type,
        markup_value: eventData.markup_value,
        discount_type: eventData.discount_type,
        discount_value: eventData.discount_value,
      };

      console.log("=== EVENT CREATION DEBUG ===");
      console.log("User ID:", user.id);
      console.log("Form data:", eventData);
      console.log("Insert payload:", insertPayload);
      console.log("Payload keys:", Object.keys(insertPayload));
      console.log("Payload values:", Object.values(insertPayload));
      console.log("================================");

      console.log("Attempting to insert event...");
      const res = await supabase
        .from("events")
        .insert(insertPayload)
        .select()
        .single();

      if (res.error) {
        console.error("Event insert failed:", res.error);
        console.error("Error details:", {
          message: res.error.message,
          details: res.error.details,
          hint: res.error.hint,
          code: res.error.code,
        });
        console.error("Full error object:", res.error);

        // Try to provide more helpful error messages
        if (res.error.message.includes("null value")) {
          throw new Error(
            "Missing required fields. Please check all form inputs."
          );
        } else if (res.error.message.includes("permission")) {
          throw new Error(
            "Permission denied. Please make sure you're logged in."
          );
        } else if (res.error.message.includes("foreign key")) {
          throw new Error(
            "Invalid user reference. Please try logging out and back in."
          );
        } else {
          throw new Error(`Event creation failed: ${res.error.message}`);
        }
      }

      console.log("Event created successfully:", res.data);
      const event = res.data as { id: string };

      // 2. Insert event items
      if (items.length > 0) {
        const { error: itemsError } = await supabase.from("event_items").insert(
          items.map((item) => ({
            event_id: event.id,
            item_name: item.item_name,
            item_description: item.item_description,
            item_quantity: Number(item.item_quantity),
            cost: Number(item.item_cost) || 0,
          }))
        );
        if (itemsError) {
          console.warn("Event items insert failed:", itemsError.message);
          toast.message("Event created but items failed to save", {
            description: itemsError.message,
          });
        }
      }

      // 3. Insert attendees stats row
      try {
        const { error: attendeesErr } = await supabase
          .from("attendees")
          .insert({
            event_id: event.id,
            expected_attendees: Number(expectedAttendees) || 0,
            event_attendees: 0,
          });
        if (attendeesErr) {
          console.warn("Attendees row insert failed:", attendeesErr.message);
        }
      } catch (attErr: any) {
        console.warn("Attendees insert exception:", attErr?.message);
      }

      // 4. Create attendance and feedback portals
      try {
        // Generate unique tokens for the portals
        const attendanceToken = `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const feedbackToken = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create attendance portal
        const { error: attendancePortalError } = await supabase
          .from("attendance_portals")
          .insert({
            event_id: event.id,
            token: attendanceToken,
            is_active: true,
            created_by: user.id,
            title: `Attendance Portal - ${eventData.title}`,
            description: `Attendance check-in portal for ${eventData.title}`,
            expires_at: null,
          });

        if (attendancePortalError) {
          console.warn("Attendance portal creation failed:", attendancePortalError.message);
          console.warn("Attendance portal error details:", attendancePortalError);
        } else {
          console.log("Attendance portal created successfully:", attendanceToken);
        }

        // Create feedback portal
        const { error: feedbackPortalError } = await supabase
          .from("feedback_portals")
          .insert({
            event_id: event.id,
            token: feedbackToken,
            is_active: true,
            created_by: user.id,
            title: `Feedback Portal - ${eventData.title}`,
            description: `Feedback collection portal for ${eventData.title}`,
            expires_at: null,
          });

        if (feedbackPortalError) {
          console.warn("Feedback portal creation failed:", feedbackPortalError.message);
          console.warn("Feedback portal error details:", feedbackPortalError);
        } else {
          console.log("Feedback portal created successfully:", feedbackToken);
        }

        console.log("Portal creation process completed");
      } catch (portalErr: any) {
        console.warn("Portal creation exception:", portalErr?.message);
        console.warn("Portal creation exception details:", portalErr);
      }

      // Create notification for successful event creation
      try {
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "event_created",
          title: "Event Created Successfully",
          message: `Your event "${eventData.title}" has been created and is now live!`,
          event_id: event.id,
          link_url: `/event/${event.id}`,
          metadata: { event_title: eventData.title }
        });
      } catch (notifError) {
        console.warn("Failed to create event creation notification:", notifError);
        // Don't fail the whole submission if notification fails
      }

      toast.success("Event created successfully!");
      setShowRedirectModal(true);
      
      // Dispatch event creation event to refresh counters
      window.dispatchEvent(new CustomEvent('eventCreated'));
      
      try {
        console.log("Redirecting to new event:", event.id);
        router.push(`/event/${event.id}`);
      } catch (navErr) {
        console.warn("router.push failed, falling back to hard navigation", navErr);
        window.location.href = `/event/${event.id}`;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Create Event</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Event Details */}
        <div className="space-y-4">
          <Label htmlFor="title">Event Title</Label>
          <Input
            id="title"
            name="title"
            value={eventData.title}
            onChange={handleEventChange}
            required
          />
          {/* Cover preview directly under the title */}
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border">
              <img
                src={imagePreview || "/images/template/event_template.webp"}
                alt="Event cover preview"
                className="h-48 w-full object-cover"
              />
            </div>
            <div>
              <Label htmlFor="image">Event Image</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>
          </div>
          <Label htmlFor="type">Type</Label>
          <Select
            name="type"
            value={eventData.type}
            onValueChange={(value) =>
              setEventData((prev) => ({ ...prev, type: value }))
            }
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            value={eventData.description}
            onChange={handleEventChange}
            required
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        {/* Step 2: Location and Date */}
        <div className="space-y-4">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            value={eventData.location}
            onChange={handleEventChange}
            required
          />
          <Label htmlFor="date">Date</Label>
          <DatePicker
            date={eventData.date}
            setDate={(date) => setEventData((prev) => ({ ...prev, date }))}
            placeholder="MM/DD/YYYY"
            name="date"
            required
          />
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_online"
              name="is_online"
              checked={eventData.is_online}
              onChange={(e) =>
                setEventData((prev) => ({
                  ...prev,
                  is_online: e.target.checked,
                }))
              }
              className="rounded border-gray-300"
            />
            <Label htmlFor="is_online">This is an online event</Label>
          </div>
          <div>
            <Label htmlFor="expected_attendees">Expected Attendees</Label>
            <Input
              id="expected_attendees"
              type="number"
              min={0}
              value={expectedAttendees}
              onChange={(e) => setExpectedAttendees(parseInt(e.target.value) || 0)}
              placeholder="e.g., 150"
            />
            <p className="text-xs text-slate-500 mt-1">Used for planning, budget allocation and analytics.</p>
          </div>
        </div>
        {/* Step 3: Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Event Items</Label>
            <Button type="button" variant="outline" onClick={addItem}>
              + Add Item
            </Button>
          </div>
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end border p-4 rounded-lg mb-2 bg-muted/20"
            >
              <div>
                <Label>Item Name</Label>
                <Input
                  value={item.item_name}
                  onChange={(e) =>
                    handleItemChange(idx, "item_name", e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={item.item_description}
                  onChange={(e) =>
                    handleItemChange(idx, "item_description", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.item_quantity}
                  onChange={(e) =>
                    handleItemChange(idx, "item_quantity", parseInt(e.target.value) || 1)
                  }
                  required
                />
              </div>
              <div>
                <Label>Cost (PHP)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.item_cost}
                  onChange={(e) =>
                    handleItemChange(idx, "item_cost", parseFloat(e.target.value) || 0)
                  }
                  required
                />
              </div>
              <div className="flex items-center h-full">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Step 4: Pricing & Markup */}
        <div className="space-y-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Event Pricing</h3>
          
          {/* Markup Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-base font-medium">Markup Type</Label>
              <span className="text-sm text-slate-500">(Required)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select
                  value={eventData.markup_type}
                  onValueChange={(value: "percentage" | "fixed") =>
                    setEventData((prev) => ({ ...prev, markup_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select markup type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (PHP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={eventData.markup_type === "percentage" ? "e.g., 25" : "e.g., 1500"}
                  value={eventData.markup_value || ""}
                  onChange={(e) =>
                    setEventData((prev) => ({ 
                      ...prev, 
                      markup_value: parseFloat(e.target.value) || 0 
                    }))
                  }
                  required
                />
              </div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {eventData.markup_type === "percentage" 
                ? "Add a percentage markup to your total item costs (e.g., 25% = 25)"
                : "Add a fixed amount markup to your total item costs (e.g., 1500 PHP)"
              }
            </div>
          </div>

          {/* Discount Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-base font-medium">Discount (Optional)</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select
                  value={eventData.discount_type}
                  onValueChange={(value: "none" | "percentage" | "fixed") =>
                    setEventData((prev) => ({ ...prev, discount_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Discount</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (PHP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {eventData.discount_type !== "none" && (
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={eventData.discount_type === "percentage" ? "e.g., 10" : "e.g., 500"}
                    value={eventData.discount_value || ""}
                    onChange={(e) =>
                      setEventData((prev) => ({ 
                        ...prev, 
                        discount_value: parseFloat(e.target.value) || 0 
                      }))
                    }
                  />
                </div>
              )}
            </div>
            {eventData.discount_type !== "none" && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {eventData.discount_type === "percentage" 
                  ? "Apply a percentage discount to the final price (e.g., 10% = 10)"
                  : "Apply a fixed amount discount to the final price (e.g., 500 PHP)"
                }
              </div>
            )}
          </div>

          {/* Pricing Preview */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Pricing Preview</h4>
            {(() => {
              const totalItemCost = items.reduce((sum, item) => sum + ((item.item_cost || 0) * (item.item_quantity || 1)), 0);
              const markupAmount = eventData.markup_type === "percentage" 
                ? totalItemCost * (eventData.markup_value / 100)
                : eventData.markup_value;
              const priceAfterMarkup = totalItemCost + markupAmount;
              const discountAmount = eventData.discount_type === "percentage"
                ? priceAfterMarkup * (eventData.discount_value / 100)
                : eventData.discount_type === "fixed"
                ? eventData.discount_value
                : 0;
              const finalPrice = Math.max(0, priceAfterMarkup - discountAmount);
              
              return (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Total Item Cost:</span>
                    <span className="font-medium">PHP {totalItemCost.toFixed(2)}</span>
                  </div>
                  {eventData.markup_value > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Markup:
                      </span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {eventData.markup_type === "percentage" ? `${eventData.markup_value}%` : `PHP ${eventData.markup_value}`}
                      </span>
                    </div>
                  )}
                  {eventData.discount_type !== "none" && eventData.discount_value > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Discount:
                      </span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {eventData.discount_type === "percentage" ? `${eventData.discount_value}%` : `PHP ${eventData.discount_value}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-semibold text-lg">
                    <span>Final Event Price:</span>
                    <span className="text-blue-600 dark:text-blue-400">PHP {finalPrice.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating Event..." : "Create Event"}
        </Button>
      </form>

      {/* Redirect modal */}
      <Dialog open={showRedirectModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Event created</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Please wait while we load and redirect you to your event…</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading popup for event creation */}
      <LoadingPopup
        isOpen={isSubmitting}
        title="Creating Event"
        description="Please wait while we create your event and set up everything for you..."
      />
    </div>
  );
}
