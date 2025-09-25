"use client";

import { useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
  const [eventData, setEventData] = useState({
    title: "",
    type: "", // Changed from category to type
    description: "",
    location: "",
    date: undefined as Date | undefined,
    is_online: false, // Added is_online field
  });
  const [items, setItems] = useState<{ item_name: string; item_description: string; item_quantity: number; }[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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
      { item_name: "", item_description: "", item_quantity: 1 },
    ]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate form data
    if (!eventData.title.trim()) {
      toast.error("Event title is required");
      setIsSubmitting(false);
      return;
    }
    if (!eventData.type) {
      toast.error("Event type is required");
      setIsSubmitting(false);
      return;
    }
    // Allow optional fields; only title is strictly required for minimal draft

    // Additional validation for database constraints
    if (!eventData.title.trim() || eventData.title.trim().length < 1) {
      toast.error("Event title cannot be empty");
      setIsSubmitting(false);
      return;
    }

    // Optional: skip strict description check to allow empty event items/details

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to create an event");
      }

      // 0. Prepare image URL (upload if provided; else upload template to user's folder)
      let imageUrl: string | null = null;
      try {
        const fileToUpload: File | Blob | null = imageFile
          ? imageFile
          : await (async () => {
              const res = await fetch("/images/template/event_template.jpg");
              if (!res.ok) return null;
              const blob = await res.blob();
              return new File([blob], "event_template.jpg", {
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
          }))
        );
        if (itemsError) {
          console.warn("Event items insert failed:", itemsError.message);
          toast.message("Event created but items failed to save", {
            description: itemsError.message,
          });
        }
      }
      toast.success("Event created successfully!");
      router.push(`/event/${event.id}`);
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
                src={imagePreview || "/images/template/event_template.jpg"}
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
              className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border p-4 rounded-lg mb-2 bg-muted/20"
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
                    handleItemChange(idx, "item_quantity", e.target.value)
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating Event..." : "Create Event"}
        </Button>
      </form>
    </div>
  );
}
