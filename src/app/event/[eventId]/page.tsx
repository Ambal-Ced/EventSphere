"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  MessageCircle,
  Calendar,
  MapPin,
  ArrowLeft,
  Users,
  X,
  Camera,
  Loader2,
  Edit,
  UserPlus,
  Trash2,
  Plus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { deleteEventImage } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  description: string;
  category: string; // Use category to match database schema
  location: string;
  date: string;
  image_url: string;
  user_id: string; // Use user_id to match database schema
  is_public: boolean; // Use is_public to match database schema
  created_at: string;
  updated_at: string;
  status: string;
  role: string;
}

interface EventMember {
  id: string;
  user_id: string;
  event_id: string;
  role: string;
  joined_at: string;
  profile?: {
    full_name: string;
    avatar_url?: string;
  };
}

export default function SingleEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [eventMembers, setEventMembers] = useState<EventMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);

  // Event settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [aiChatEnabled, setAiChatEnabled] = useState(false);
  const [dataAnalyticsEnabled, setDataAnalyticsEnabled] = useState(false);
  const [allowInvites, setAllowInvites] = useState(true);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isRemovingCollaborator, setIsRemovingCollaborator] = useState<
    string | null
  >(null);

  // Invite and collaboration state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<"moderator" | "member">(
    "member"
  );
  const [inviteCode, setInviteCode] = useState<string>("");
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  // Event status management
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Status options
  const statusOptions = [
    { value: "coming_soon", label: "Coming Soon", color: "text-green-400" },
    { value: "ongoing", label: "Ongoing", color: "text-green-400" },
    { value: "done", label: "Done/Ended", color: "text-gray-400" },
    { value: "cancelled", label: "Cancelled", color: "text-red-400" },
    { value: "archived", label: "Archived", color: "text-yellow-400" },
  ];

  // Event editing state
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState({
    title: "",
    description: "",
    image_url: "",
    date: "",
    location: "",
    type: "", // Changed from category to type
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Event items state
  const [eventItems, setEventItems] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    item_name: "",
    item_description: "",
    item_quantity: 1,
  });
  const [editingItem, setEditingItem] = useState<any>(null);

  // Event Script state
  const [scriptText, setScriptText] = useState<string>("");
  // Scripts uploaded
  const [scripts, setScripts] = useState<any[]>([]);
  const [isUploadingScript, setIsUploadingScript] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [showScriptPreview, setShowScriptPreview] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<"item" | "event">("item");
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  useEffect(() => {
    if (event) {
      fetchCollaborators();
      fetchEventItems();
      fetchEventScripts();
      checkUserAccess();
    }
  }, [event]);

  // Separate effect to check user access when auth state changes
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && event) {
        console.log("Auth effect: User authenticated, checking access");
        checkUserAccess();
      }
    };

    checkAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user && event) {
        console.log("Auth effect: User signed in, checking access");
        checkUserAccess();
      }
    });

    return () => subscription.unsubscribe();
  }, [event]);

  // Fallback effect to ensure ownership is set correctly
  useEffect(() => {
    if (event && !isOwner) {
      const fallbackCheck = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && event.user_id === user.id && !isOwner) {
          console.log("Fallback check: Setting user as owner");
          setIsOwner(true);
          setUserRole("owner");
        }
      };

      // Check after a short delay to allow other effects to run
      const timer = setTimeout(fallbackCheck, 1000);
      return () => clearTimeout(timer);
    }
  }, [event, isOwner]);

  const fetchEvent = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      console.log("fetchEvent: Event data received:", eventData);
      console.log("fetchEvent: Event creator_id:", eventData?.user_id);

      setEvent(eventData);

      // Fetch event members (you'll need to create this table)
      await fetchEventMembers();
    } catch (error: any) {
      toast.error("Failed to fetch event");
      console.error("Error fetching event:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventMembers = async () => {
    try {
      // This is a placeholder - you'll need to create an event_members table
      // For now, we'll just show the event creator
      if (event) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", event.user_id)
          .single();

        if (profileData) {
          setEventMembers([
            {
              id: "1",
              user_id: event.user_id,
              event_id: eventId,
              role: "Creator",
              joined_at: event.created_at,
              profile: profileData,
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Error fetching event members:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleEventAction = (action: string) => {
    switch (action) {
      case "settings":
        setShowSettingsModal(true);
        break;
      case "chat":
        toast.info("Event chat coming soon!");
        break;
      case "invite":
        setShowInviteModal(true);
        break;
      default:
        break;
    }
  };

  // Event settings functions
  const handleDeleteEvent = async () => {
    if (!event) return;

    setDeleteType("event");
    setShowDeleteConfirm(true);
  };

  const confirmDeleteEvent = async () => {
    if (!event) return;

    setIsDeletingEvent(true);
    try {
      // Delete image from storage bucket if it exists
      await deleteEventImage(event.image_url, event.user_id, supabase);

      // Delete the event from database
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id);

      if (error) throw error;

      toast.success("Event deleted successfully!");
      router.push("/events");
    } catch (error: any) {
      toast.error("Failed to delete event: " + error.message);
    } finally {
      setIsDeletingEvent(false);
      setShowDeleteConfirm(false);
    }
  };

  // Update event status
  const handleUpdateStatus = async () => {
    console.log("handleUpdateStatus called with:", {
      event: event?.id,
      selectedStatus,
    });

    if (!event || !selectedStatus) {
      console.log("Early return - missing event or selectedStatus");
      return;
    }

    setIsUpdatingStatus(true);

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log("Status update timeout - forcing reset");
      setIsUpdatingStatus(false);
      toast.error("Status update timed out. Please try again.");
    }, 30000); // 30 seconds timeout

    try {
      console.log("Starting status update for event:", event.id);

      let updateData: any = { status: selectedStatus };

      // Special handling for cancelled events - keep data for analytics but delete image
      if (selectedStatus === "cancelled") {
        updateData = {
          status: selectedStatus,
          // Keep all data for analytics purposes
        };

        // Delete image from storage bucket if it exists
        if (event.image_url) {
          console.log("Deleting event image for cancelled event");
          await deleteEventImage(event.image_url, event.user_id, supabase);
        }
      }

      // Archive events - no data changes, just status update
      if (selectedStatus === "archived") {
        updateData = {
          status: selectedStatus,
          // Keep all data unchanged for analytics
        };
      }

      console.log("Updating event with data:", updateData);

      const { error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", event.id);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Event status updated successfully in database");

      // Clear timeout since we succeeded
      clearTimeout(timeoutId);

      // Update local state
      setEvent((prev) => (prev ? { ...prev, ...updateData } : null));

      toast.success(`Event status updated to ${selectedStatus}`);
      setShowStatusModal(false);
      setSelectedStatus("");

      // Redirect to events page if cancelled or archived
      if (selectedStatus === "cancelled" || selectedStatus === "archived") {
        router.push("/events");
      }
    } catch (error: any) {
      console.error("Error in handleUpdateStatus:", error);
      toast.error("Failed to update event status: " + error.message);
    } finally {
      console.log("Setting isUpdatingStatus to false");
      clearTimeout(timeoutId);
      setIsUpdatingStatus(false);
    }
  };

  // Auto-update status based on date
  const updateEventStatusAutomatically = async () => {
    if (!event) return;

    const now = new Date();
    const eventDate = new Date(event.date);
    const eventEndDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours after start

    let newStatus = event.status;

    if (event.status === "coming_soon" && now >= eventDate) {
      newStatus = "ongoing";
    } else if (event.status === "ongoing" && now >= eventEndDate) {
      newStatus = "done";
    }

    if (newStatus !== event.status) {
      // Use a separate function for automatic updates
      try {
        const { error } = await supabase
          .from("events")
          .update({ status: newStatus })
          .eq("id", event.id);

        if (error) throw error;

        // Update local state
        setEvent((prev) => (prev ? { ...prev, status: newStatus } : null));
        console.log(`Event status automatically updated to ${newStatus}`);
      } catch (error: any) {
        console.error("Failed to auto-update event status:", error);
      }
    }
  };

  const handleRemoveCollaborator = async (
    collaboratorId: string,
    collaboratorName: string
  ) => {
    if (
      !confirm(
        `Are you sure you want to remove ${collaboratorName} from this event?`
      )
    ) {
      return;
    }

    setIsRemovingCollaborator(collaboratorId);
    try {
      const { error } = await supabase
        .from("event_collaborators")
        .delete()
        .eq("id", collaboratorId);

      if (error) throw error;

      // Remove from local state
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
      toast.success(`${collaboratorName} removed from event successfully!`);
    } catch (error: any) {
      toast.error("Failed to remove collaborator: " + error.message);
    } finally {
      setIsRemovingCollaborator(null);
    }
  };

  const handleToggleAiChat = () => {
    setAiChatEnabled(!aiChatEnabled);
    toast.info(`AI Chat ${!aiChatEnabled ? "enabled" : "disabled"}`);
  };

  const handleToggleDataAnalytics = () => {
    setDataAnalyticsEnabled(!dataAnalyticsEnabled);
    toast.info(
      `Data Analytics ${!dataAnalyticsEnabled ? "enabled" : "disabled"}`
    );
  };

  const handleUpdateEventPrivacy = async (isPublic: boolean) => {
    if (!event) return;

    try {
      const { error } = await supabase
        .from("events")
        .update({ is_public: isPublic })
        .eq("id", event.id);

      if (error) throw error;

      // Update local state
      setEvent((prev) => (prev ? { ...prev, is_public: isPublic } : null));
      toast.success(`Event is now ${isPublic ? "public" : "private"}`);
    } catch (error: any) {
      toast.error("Failed to update event privacy: " + error.message);
    }
  };

  const handleChangeRole = async (collaboratorId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("event_collaborators")
        .update({ role: newRole })
        .eq("id", collaboratorId);

      if (error) throw error;

      // Update local state
      setCollaborators((prev) =>
        prev.map((c) => (c.id === collaboratorId ? { ...c, role: newRole } : c))
      );
      toast.success(`Role changed to ${newRole}`);
    } catch (error: any) {
      toast.error("Failed to change role: " + error.message);
    }
  };

  // Generate invite code
  const generateInviteCode = async () => {
    if (!event) return;

    setIsGeneratingInvite(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const inviteCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const { data, error } = await supabase
        .from("event_invites")
        .insert({
          event_id: event.id,
          invite_code: inviteCode,
          role: inviteRole,
          created_by: user.id,
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(), // 7 days
        })
        .select()
        .single();

      if (error) throw error;

      setInviteCode(inviteCode);
      toast.success("Invite code generated successfully!");
    } catch (error: any) {
      toast.error("Failed to generate invite code: " + error.message);
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  // Fetch collaborators
  const fetchCollaborators = async () => {
    if (!event) return;

    try {
      const { data, error } = await supabase
        .from("event_collaborators")
        .select(
          `
          *,
          profiles:user_id(username, fname, lname, avatar_url)
        `
        )
        .eq("event_id", event.id);

      if (error) throw error;
      setCollaborators(data || []);
    } catch (error: any) {
      console.error("Error fetching collaborators:", error);
    }
  };

  // Event items functions
  const fetchEventItems = async () => {
    console.log("fetchEventItems called", { event });

    if (!event) {
      console.log("No event available for fetchEventItems");
      return;
    }

    try {
      console.log("Fetching items for event:", event.id);
      const { data, error } = await supabase
        .from("event_items")
        .select("*")
        .eq("event_id", event.id);

      if (error) {
        console.error("Supabase error in fetchEventItems:", error);
        throw error;
      }

      console.log("Event items fetched successfully:", data);
      setEventItems(data || []);
    } catch (error: any) {
      console.error("Error fetching event items:", error);
    }
  };

  const fetchEventScripts = async () => {
    if (!event) return;
    try {
      const { data, error } = await supabase
        .from("event_script")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setScripts(data || []);
    } catch (error: any) {
      console.error("Error fetching scripts:", error);
    }
  };

  const getStoragePathFromPublicUrl = (publicUrl: string, bucketId: string) => {
    try {
      const url = new URL(publicUrl);
      const idx = url.pathname.indexOf(`/${bucketId}/`);
      if (idx !== -1) {
        return url.pathname.substring(idx + bucketId.length + 2); // skip '/{bucketId}/'
      }
      // Fallback: look for last '/public/' then bucket
      const marker = `/public/${bucketId}/`;
      const markerIdx = url.pathname.indexOf(marker);
      if (markerIdx !== -1) {
        return url.pathname.substring(markerIdx + marker.length);
      }
    } catch {}
    return "";
  };

  const handleAddItem = async () => {
    console.log("handleAddItem called", { event, newItem });

    if (!event || !newItem.item_name.trim()) {
      toast.error("Item name is required");
      return;
    }

    try {
      console.log("Attempting to insert item:", {
        event_id: event.id,
        item_name: newItem.item_name.trim(),
        item_description: newItem.item_description.trim(),
        item_quantity: newItem.item_quantity,
      });

      const { data, error } = await supabase
        .from("event_items")
        .insert({
          event_id: event.id,
          item_name: newItem.item_name.trim(),
          item_description: newItem.item_description.trim(),
          item_quantity: newItem.item_quantity,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Item inserted successfully:", data);
      setEventItems((prev) => [...prev, data]);
      setNewItem({ item_name: "", item_description: "", item_quantity: 1 });
      setShowAddForm(false);
      toast.success("Item added successfully!");
    } catch (error: any) {
      console.error("Error in handleAddItem:", error);
      toast.error("Failed to add item: " + error.message);
    }
  };

  const handleEditItem = (item: any) => {
    console.log("handleEditItem called", { item });
    setEditingItem(item);
    setNewItem({
      item_name: item.item_name,
      item_description: item.item_description,
      item_quantity: item.item_quantity,
    });
    setShowAddForm(true);
  };

  const handleUpdateItem = async () => {
    console.log("handleUpdateItem called", { editingItem, newItem });

    if (!editingItem || !newItem.item_name.trim()) {
      toast.error("Item name is required");
      return;
    }

    try {
      console.log("Attempting to update item:", {
        id: editingItem.id,
        item_name: newItem.item_name.trim(),
        item_description: newItem.item_description.trim(),
        item_quantity: newItem.item_quantity,
      });

      const { error } = await supabase
        .from("event_items")
        .update({
          item_name: newItem.item_name.trim(),
          item_description: newItem.item_description.trim(),
          item_quantity: newItem.item_quantity,
        })
        .eq("id", editingItem.id);

      if (error) {
        console.error("Supabase error in handleUpdateItem:", error);
        throw error;
      }

      console.log("Item updated successfully");
      setEventItems((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                item_name: newItem.item_name.trim(),
                item_description: newItem.item_description.trim(),
                item_quantity: newItem.item_quantity,
              }
            : item
        )
      );

      setNewItem({ item_name: "", item_description: "", item_quantity: 1 });
      setShowAddForm(false);
      setEditingItem(null);
      toast.success("Item updated successfully!");
    } catch (error: any) {
      console.error("Error in handleUpdateItem:", error);
      toast.error("Failed to update item: " + error.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const item = eventItems.find((i) => i.id === itemId);
    if (!item) return;

    setItemToDelete(item);
    setDeleteType("item");
    setShowDeleteConfirm(true);
  };

  const confirmDeleteItem = async () => {
    console.log("confirmDeleteItem called", { itemToDelete });

    if (!itemToDelete) return;

    try {
      console.log("Attempting to delete item:", itemToDelete.id);
      const { error } = await supabase
        .from("event_items")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) {
        console.error("Supabase error in confirmDeleteItem:", error);
        throw error;
      }

      console.log("Item deleted successfully");
      setEventItems((prev) =>
        prev.filter((item) => item.id !== itemToDelete.id)
      );
      toast.success("Item deleted successfully!");
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (error: any) {
      console.error("Error in confirmDeleteItem:", error);
      toast.error("Failed to delete item: " + error.message);
    }
  };

  const handleCancelItemForm = () => {
    setShowAddForm(false);
    setEditingItem(null);
    setNewItem({ item_name: "", item_description: "", item_quantity: 1 });
  };

  // Check user role and ownership
  const checkUserAccess = async () => {
    if (!event) {
      console.log("checkUserAccess: No event loaded yet");
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("checkUserAccess: Auth error:", userError);
        return;
      }

      if (!user) {
        console.log("checkUserAccess: No authenticated user");
        return;
      }

      console.log("checkUserAccess: User ID:", user.id);
      console.log("checkUserAccess: Event creator_id:", event.user_id);
      console.log(
        "checkUserAccess: Are they equal?",
        event.user_id === user.id
      );

      // Check if user is owner
      if (event.user_id === user.id) {
        console.log("checkUserAccess: Setting user as owner");
        setIsOwner(true);
        setUserRole("owner");
        return;
      }

      // Check if user is collaborator
      const { data: collaborator } = await supabase
        .from("event_collaborators")
        .select("role")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .single();

      if (collaborator) {
        console.log(
          "checkUserAccess: User is collaborator with role:",
          collaborator.role
        );
        setUserRole(collaborator.role);
      } else {
        console.log("checkUserAccess: User is not a collaborator");
      }
    } catch (error: any) {
      console.error("checkUserAccess: Error:", error);
    }
  };

  // Event editing handlers
  const handleEditEvent = () => {
    if (event) {
      setEditingEvent({
        title: event.title,
        description: event.description || "",
        image_url: event.image_url,
        date: event.date,
        location: event.location,
        type: event.category,
      });
      setIsEditingEvent(true);
    }
  };

  const handleCancelEditEvent = () => {
    setIsEditingEvent(false);
    setSelectedImage(null);
    setImagePreview("");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEvent = async () => {
    if (!editingEvent.title.trim()) {
      toast.error("Event title is required");
      return;
    }

    if (!editingEvent.date) {
      toast.error("Event date is required");
      return;
    }

    if (!editingEvent.location.trim()) {
      toast.error("Event location is required");
      return;
    }

    if (!editingEvent.type.trim()) {
      toast.error("Event type is required");
      return;
    }

    try {
      let finalImageUrl = editingEvent.image_url;

      // Upload new image if selected
      if (selectedImage) {
        const fileExt = selectedImage.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("event-images")
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        finalImageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-images/${fileName}`;
      }

      // Update event in database
      const { data, error } = await supabase
        .from("events")
        .update({
          title: editingEvent.title.trim(),
          description: editingEvent.description.trim(),
          image_url: finalImageUrl,
          date: editingEvent.date,
          location: editingEvent.location.trim(),
          category: editingEvent.type.trim(),
        })
        .eq("id", eventId)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setEvent(data);
      setIsEditingEvent(false);
      setSelectedImage(null);
      setImagePreview("");
      toast.success("Event updated successfully!");
    } catch (error: any) {
      toast.error("Failed to update event: " + error.message);
      console.error("Error updating event:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Event not found</div>
          <Button asChild>
            <Link href="/events">Back to Events</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header with Back Button */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/events">
              <Button variant="ghost" className="text-white hover:bg-slate-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
            </Link>
            <div className="h-6 w-px bg-slate-600" />
            <h1 className="text-2xl font-semibold text-white">Event Details</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content Area - Takes 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            {/* Event Title */}
            <div className="text-center">
              {isEditingEvent ? (
                <div className="space-y-4">
                  <Input
                    value={editingEvent.title}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        title: e.target.value,
                      })
                    }
                    className="text-4xl font-bold text-center bg-slate-800 border-amber-500/30 text-white"
                    placeholder="Event Title"
                  />
                  <div className="flex items-center justify-center gap-4 text-slate-300 text-sm mb-6">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <Input
                        type="datetime-local"
                        value={
                          editingEvent.date
                            ? new Date(editingEvent.date)
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          setEditingEvent({
                            ...editingEvent,
                            date: e.target.value,
                          })
                        }
                        className="bg-slate-800 border-amber-500/30 text-white text-sm w-auto"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <Input
                        value={editingEvent.location}
                        onChange={(e) =>
                          setEditingEvent({
                            ...editingEvent,
                            location: e.target.value,
                          })
                        }
                        placeholder="Location"
                        className="bg-slate-800 border-amber-500/30 text-white text-sm w-auto"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingEvent.type}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditingEvent({
                            ...editingEvent,
                            type: e.target.value,
                          })
                        }
                        placeholder="Type"
                        className="bg-slate-800 border-amber-500/30 text-white text-sm w-auto"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={handleSaveEvent}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelEditEvent}
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h1 className="text-4xl font-bold text-white mb-4">
                    {event.title}
                  </h1>
                  <div className="flex items-center justify-between text-slate-300 text-sm mb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(event.date)}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {event.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Type:</span>
                        <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-200">
                          {event.category}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleEditEvent}
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Event
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Event Image */}
            <div className="relative w-full h-80 rounded-lg overflow-hidden bg-slate-700">
              {isEditingEvent ? (
                <div className="relative w-full h-full">
                  <Image
                    src={imagePreview || editingEvent.image_url}
                    alt={editingEvent.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <Label
                        htmlFor="event-image"
                        className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Change Image
                      </Label>
                      <input
                        id="event-image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <Image
                  src={event.image_url}
                  alt={event.title}
                  fill
                  className="object-cover"
                />
              )}
            </div>

            {/* Event Description - Yellow Box Concept */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-amber-400 mb-3">
                Event Description
              </h3>
              {isEditingEvent ? (
                <div className="space-y-4">
                  <Input
                    value={editingEvent.description}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        description: e.target.value,
                      })
                    }
                    placeholder="Enter event description"
                    className="bg-slate-800 border-amber-500/30 text-white"
                  />
                </div>
              ) : (
                <p className="text-slate-300 leading-relaxed text-lg">
                  {event.description ||
                    "No description provided for this event."}
                </p>
              )}
            </div>

            {/* Event Items Management */}
            {isOwner && (
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">
                  Event Items
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Add New Item Box */}
                  <div
                    onClick={() => setShowAddForm(true)}
                    className="border-2 border-dashed border-green-500/50 rounded-lg p-6 text-center cursor-pointer hover:border-green-500/70 hover:bg-green-500/5 transition-all h-48 flex flex-col items-center justify-center bg-slate-700/50"
                  >
                    <Plus className="w-12 h-12 text-green-500 mb-3" />
                    <div className="text-green-500 text-lg font-semibold mb-2">
                      Add New Item
                    </div>
                    <div className="text-green-400/70 text-sm">
                      Click to add items to this event
                    </div>
                  </div>

                  {/* Existing Items */}
                  {eventItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-700/50 border border-green-500/30 rounded-lg p-6 h-48 relative"
                    >
                      {/* Action Buttons - Top Right */}
                      <div className="flex items-center gap-2 absolute top-3 right-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditItem(item)}
                          className="text-green-400 hover:bg-green-500/20 hover:text-green-300"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-400 hover:bg-red-500/20 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Content */}
                      <div className="pt-8">
                        <div className="text-green-400 text-xl font-semibold mb-3 truncate">
                          {item.item_name}
                        </div>
                        <div
                          className="text-slate-300 text-base mb-4 overflow-hidden"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            lineHeight: "1.4",
                            maxHeight: "2.8em",
                          }}
                        >
                          {item.item_description}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-sm font-medium">
                            Quantity:
                          </span>
                          <span className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                            {item.item_quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event Script */}
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Event Script</h3>
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-amber-400 mb-3">
                    Event Script
                  </h4>
                  {isOwner && (
                    <div className="mb-4">
                      <input
                        id="script-file"
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !event) return;
                          setIsUploadingScript(true);
                          try {
                            const safeName = `${event.id}-${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
                            const { data: upload, error: upErr } = await supabase.storage
                              .from("event-docs")
                              .upload(safeName, file, { upsert: false });
                            if (upErr) throw upErr;
                            const { data: pub } = supabase.storage
                              .from("event-docs")
                              .getPublicUrl(upload.path);
                            const publicUrl = pub?.publicUrl || "";
                            const {
                              data: { user },
                            } = await supabase.auth.getUser();
                            const { error: insErr } = await supabase
                              .from("event_script")
                              .insert({
                                event_id: event.id,
                                user_id: user?.id,
                                file_url: publicUrl,
                                file_name: file.name,
                                file_size: file.size,
                                mime_type: file.type,
                              });
                            if (insErr) throw insErr;
                            toast.success("Script uploaded");
                            fetchEventScripts();
                          } catch (err: any) {
                            toast.error(err.message || "Upload failed");
                          } finally {
                            setIsUploadingScript(false);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                      <label
                        htmlFor="script-file"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                      >
                        {isUploadingScript ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                          </>
                        ) : (
                          <>Upload DOCX/PDF</>
                        )}
                      </label>
                    </div>
                  )}
                  <div className="space-y-2">
                    {scripts.length === 0 ? (
                      <div className="text-slate-400 text-sm">No scripts uploaded.</div>
                    ) : (
                      scripts.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-slate-800/60 border border-slate-600 rounded-md p-3">
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">{s.file_name}</div>
                            <div className="text-slate-400 text-xs">{s.mime_type} • {(s.file_size || 0) / 1024 | 0} KB</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                              onClick={async () => {
                                try {
                                  let url = s.file_url;
                                  if (s.mime_type === "application/pdf" || url.toLowerCase().endsWith(".pdf")) {
                                    url = `${s.file_url}#toolbar=0&navpanes=0&scrollbar=0`;
                                  } else if (
                                    s.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                                    url.toLowerCase().endsWith(".docx")
                                  ) {
                                    url = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(s.file_url)}`;
                                  }
                                  setPreviewUrl(url);
                                  setShowScriptPreview(true);
                                } catch (err: any) {
                                  toast.error("Failed to preview file");
                                }
                              }}
                            >
                              Preview
                            </Button>
                            {isOwner && (
                              <Button
                                variant="destructive"
                                onClick={async () => {
                                  try {
                                    // First delete DB record
                                    const { error: delErr } = await supabase
                                      .from("event_script")
                                      .delete()
                                      .eq("id", s.id);
                                    if (delErr) throw delErr;

                                    // Then delete file from storage bucket
                                    const path = getStoragePathFromPublicUrl(s.file_url, "event-docs");
                                    if (path) {
                                      const { error: storageErr } = await supabase.storage
                                        .from("event-docs")
                                        .remove([path]);
                                      if (storageErr) console.warn("Failed to remove from storage:", storageErr);
                                    }

                                    toast.success("Deleted script");
                                    fetchEventScripts();
                                  } catch (err: any) {
                                    toast.error("Failed to delete");
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Green Rectangle Concept */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {/* Event Actions */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-green-400 mb-6">
                  Event Actions
                </h3>
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                    onClick={() => handleEventAction("settings")}
                  >
                    <Settings className="w-4 h-4 mr-3" />
                    Event Settings
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                    onClick={() => handleEventAction("chat")}
                  >
                    <MessageCircle className="w-4 h-4 mr-3" />
                    Event Chat
                  </Button>

                  {/* Set Status Button - Only visible to event owners */}
                  {isOwner && (
                    <Button
                      variant="outline"
                      className="w-full justify-start border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                      onClick={() => {
                        setSelectedStatus(event?.status || "coming_soon");
                        setShowStatusModal(true);
                      }}
                    >
                      <Calendar className="w-4 h-4 mr-3" />
                      Set Status
                    </Button>
                  )}
                </div>
              </div>

              {/* Event Members/People */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-purple-400 mb-6">
                  Event Members
                </h3>
                <div className="space-y-4">
                  {collaborators.length > 0 ? (
                    collaborators.map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20"
                      >
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                          {collaborator.profiles?.avatar_url ? (
                            <Image
                              src={collaborator.profiles.avatar_url}
                              alt="Avatar"
                              width={40}
                              height={40}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <Users className="w-5 h-5 text-purple-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">
                            {collaborator.profiles?.fname &&
                            collaborator.profiles?.lname
                              ? `${collaborator.profiles.fname} ${collaborator.profiles.lname}`
                              : collaborator.profiles?.username ||
                                "Unknown User"}
                          </div>
                          <div className="text-purple-300 text-sm capitalize">
                            {collaborator.role}
                          </div>
                        </div>
                        {isOwner && collaborator.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveCollaborator(
                                collaborator.id,
                                collaborator.profiles?.fname &&
                                  collaborator.profiles?.lname
                                  ? `${collaborator.profiles.fname} ${collaborator.profiles.lname}`
                                  : collaborator.profiles?.username ||
                                      "Unknown User"
                              )
                            }
                            disabled={
                              isRemovingCollaborator === collaborator.id
                            }
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-1"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                      <div className="text-purple-300 text-sm">
                        No members yet
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-start border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleEventAction("invite")}
                    disabled={!allowInvites}
                  >
                    <UserPlus className="w-4 h-4 mr-3" />
                    Add Members
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-amber-500/30 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">
                Invite People
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-white">Role for Invited User</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value: "moderator" | "member") =>
                    setInviteRole(value)
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-amber-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member (View Only)</SelectItem>
                    <SelectItem value="moderator">
                      Moderator (Can Edit)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!inviteCode ? (
                <Button
                  onClick={generateInviteCode}
                  disabled={isGeneratingInvite}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isGeneratingInvite
                    ? "Generating..."
                    : "Generate Invite Code"}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="text-center">
                    <Label className="text-white text-sm">Invite Code</Label>
                    <div className="bg-slate-700 border border-amber-500/30 rounded-lg p-3 mt-2">
                      <code className="text-2xl font-mono text-amber-400 font-bold tracking-wider">
                        {inviteCode}
                      </code>
                    </div>
                    <p className="text-slate-400 text-xs mt-2">
                      Share this code with others to invite them to your event
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white text-sm">Invite Link</Label>
                    <div className="bg-slate-700 border border-amber-500/30 rounded-lg p-3">
                      <code className="text-sm text-amber-400 break-all">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/events?code=${inviteCode}`
                          : ""}
                      </code>
                    </div>
                    <p className="text-slate-400 text-xs">
                      Share this link - users will be redirected to the events
                      page to join
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteCode);
                        toast.success("Invite code copied to clipboard!");
                      }}
                      variant="outline"
                      className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    >
                      Copy Code
                    </Button>
                    <Button
                      onClick={() => {
                        const inviteLink =
                          typeof window !== "undefined"
                            ? `${window.location.origin}/events?code=${inviteCode}`
                            : "";
                        navigator.clipboard.writeText(inviteLink);
                        toast.success("Invite link copied to clipboard!");
                      }}
                      variant="outline"
                      className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    >
                      Copy Link
                    </Button>
                  </div>

                  <Button
                    onClick={() => {
                      setInviteCode("");
                      setShowInviteModal(false);
                    }}
                    className="w-full bg-slate-600 hover:bg-slate-700 text-white"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-emerald-500/30 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-white">
                Event Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* AI Chat Assistance */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-emerald-400 mb-2">
                      AI Chat Assistance
                    </h4>
                    <p className="text-slate-300 text-sm">
                      Enable AI-powered chat support for event participants
                    </p>
                  </div>
                  <button
                    onClick={() => setAiChatEnabled(!aiChatEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                      aiChatEnabled ? "bg-emerald-500" : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        aiChatEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Data Analytics */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-amber-400 mb-2">
                      Data Analytics
                    </h4>
                    <p className="text-slate-300 text-sm">
                      Enable detailed analytics and insights for your event
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setDataAnalyticsEnabled(!dataAnalyticsEnabled)
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                      dataAnalyticsEnabled ? "bg-amber-500" : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        dataAnalyticsEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Event Invites */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-purple-400 mb-2">
                      Event Invites
                    </h4>
                    <p className="text-slate-300 text-sm">
                      Allow participants to invite others
                    </p>
                  </div>
                  <button
                    onClick={() => setAllowInvites(!allowInvites)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                      allowInvites ? "bg-purple-500" : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        allowInvites ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Manage Collaborators */}
              <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-4">
                  Manage Collaborators
                </h4>
                {collaborators.length > 0 ? (
                  <div className="space-y-3">
                    {collaborators.map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="flex items-center justify-between p-3 bg-slate-600/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center">
                            {collaborator.profiles?.avatar_url ? (
                              <Image
                                src={collaborator.profiles.avatar_url}
                                alt="Avatar"
                                width={40}
                                height={40}
                                className="rounded-full object-cover"
                              />
                            ) : (
                              <Users className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">
                              {collaborator.profiles?.fname &&
                              collaborator.profiles?.lname
                                ? `${collaborator.profiles.fname} ${collaborator.profiles.lname}`
                                : collaborator.profiles?.username ||
                                  "Unknown User"}
                            </div>
                            <div className="text-slate-400 text-sm capitalize">
                              {collaborator.role}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium px-2 py-1 rounded-full bg-slate-600 text-white">
                            {collaborator.role}
                          </span>
                          {isOwner && collaborator.role !== "owner" && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleChangeRole(
                                    collaborator.id,
                                    collaborator.role === "moderator"
                                      ? "member"
                                      : "moderator"
                                  )
                                }
                                className="text-xs"
                              >
                                {collaborator.role === "moderator"
                                  ? "Demote"
                                  : "Promote"}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleRemoveCollaborator(
                                    collaborator.id,
                                    collaborator.profiles?.fname &&
                                      collaborator.profiles?.lname
                                      ? `${collaborator.profiles.fname} ${collaborator.profiles.lname}`
                                      : collaborator.profiles?.username ||
                                          "Unknown User"
                                  )
                                }
                                disabled={
                                  isRemovingCollaborator === collaborator.id
                                }
                              >
                                {isRemovingCollaborator === collaborator.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    <p>No collaborators yet</p>
                  </div>
                )}
              </div>

              {/* Danger Zone - Delete Event */}
              {isOwner && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-red-400 mb-2">
                    Danger Zone
                  </h4>
                  <p className="text-slate-300 text-sm mb-4">
                    Once you delete an event, there is no going back. Please be
                    certain.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteEvent}
                    disabled={isDeletingEvent}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isDeletingEvent ? "Deleting..." : "Delete Event"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-amber-500/30 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-white">
                Update Event Status
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedStatus("");
                  setIsUpdatingStatus(false);
                }}
                className="text-slate-400 hover:text-white"
                disabled={isUpdatingStatus}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Current Status Display */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Current Status
                </label>
                <div className="text-lg font-semibold text-white">
                  {statusOptions.find((s) => s.value === event?.status)
                    ?.label || "Unknown"}
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  New Status
                </label>
                <div className="space-y-2">
                  {statusOptions.map((status) => (
                    <label
                      key={status.value}
                      className="flex items-center space-x-3 cursor-pointer hover:bg-slate-700/50 rounded-lg p-3 transition-colors"
                    >
                      <input
                        type="radio"
                        name="status"
                        value={status.value}
                        checked={selectedStatus === status.value}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="text-amber-500 focus:ring-amber-500"
                      />
                      <span className={`font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Warning for Cancelled/Archived */}
              {(selectedStatus === "cancelled" ||
                selectedStatus === "archived") && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <X className="w-4 h-4" />
                    <span className="text-sm">
                      Note: Setting status to{" "}
                      {selectedStatus === "cancelled"
                        ? "Cancelled"
                        : "Archived"}{" "}
                      will:
                    </span>
                  </div>
                  <ul className="text-sm text-amber-300 mt-2 ml-6 list-disc">
                    {selectedStatus === "cancelled" ? (
                      <>
                        <li>Keep all event data for analytics purposes</li>
                        <li>Delete the event image from storage</li>
                        <li>Remove the event from "My Events" page</li>
                        <li>Event will still appear in analytics</li>
                      </>
                    ) : (
                      <>
                        <li>Keep all event data unchanged</li>
                        <li>Remove the event from "My Events" page</li>
                        <li>Event will still appear in analytics</li>
                      </>
                    )}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleUpdateStatus}
                  disabled={isUpdatingStatus || !selectedStatus}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isUpdatingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Status"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowStatusModal(false)}
                  className="border-slate-500 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-green-500/30 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-white">
                {editingItem ? "Edit Item" : "Add New Item"}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelItemForm}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-white">Item Name *</Label>
                <Input
                  value={newItem.item_name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, item_name: e.target.value })
                  }
                  placeholder="Enter item name"
                  className="bg-slate-700 border-green-500/30 text-white"
                />
              </div>

              <div>
                <Label className="text-white">Description</Label>
                <textarea
                  value={newItem.item_description}
                  onChange={(e) =>
                    setNewItem({ ...newItem, item_description: e.target.value })
                  }
                  placeholder="Enter item description (optional)"
                  className="w-full bg-slate-700 border border-green-500/30 rounded-md p-3 text-white resize-none h-20"
                />
              </div>

              <div>
                <Label className="text-white">Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.item_quantity}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      item_quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="bg-slate-700 border-green-500/30 text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={editingItem ? handleUpdateItem : handleAddItem}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {editingItem ? "Update Item" : "Add Item"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelItemForm}
                  className="border-slate-500 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-red-500/30 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">
                {deleteType === "event" ? "Delete Event" : "Delete Item"}
              </h3>
              <p className="text-slate-300">
                {deleteType === "event"
                  ? "Are you sure you want to delete this event? This action cannot be undone."
                  : `Are you sure you want to delete "${itemToDelete?.item_name}"?`}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setItemToDelete(null);
                }}
                className="flex-1 border-slate-500 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={
                  deleteType === "event"
                    ? confirmDeleteEvent
                    : confirmDeleteItem
                }
                disabled={deleteType === "event" && isDeletingEvent}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteType === "event" && isDeletingEvent ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Script Preview Modal */}
      {showScriptPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-amber-500/30 rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Script Preview</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowScriptPreview(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <iframe src={previewUrl} className="w-full h-[70vh] rounded-md bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
