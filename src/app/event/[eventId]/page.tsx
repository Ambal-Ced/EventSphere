"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { CohereClientV2 } from 'cohere-ai';

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
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Calendar,
  Brain,
  Sparkles,
  MapPin,
  ArrowLeft,
  X,
  Camera,
  Loader2,
  Edit,
  UserPlus,
  Trash2,
  Download,
  Plus,
  CheckCircle,
  FileText,
  AlertCircle,
  Save,
  ChevronDown,
  ChevronUp,
  Link2,
  QrCode,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { deleteEventImage } from "@/lib/utils";
import AIChat from "@/components/ai-chat";
import { useAIDelay } from "@/hooks/useAIDelay";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";
import QRCode from "react-qr-code";

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
  markup_type: "percentage" | "fixed";
  markup_value: number;
  discount_type: "none" | "percentage" | "fixed";
  discount_value: number;
  data_analytics_enabled?: boolean;
  ai_chat_enabled?: boolean;
  ai_insights?: string;
  insights_generated_at?: string;
  insights_generated_by?: string;
  profiles?: {
    username: string;
    fname: string;
    lname: string;
    avatar_url?: string;
  };
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
  const { addAIDelay } = useAIDelay();

  const [event, setEvent] = useState<Event | null>(null);
  const [eventMembers, setEventMembers] = useState<EventMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const canEdit = isOwner || userRole === "moderator";

  // Event settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [aiChatEnabled, setAiChatEnabled] = useState(false);
  const [dataAnalyticsEnabled, setDataAnalyticsEnabled] = useState(true); // Default to true
  const [allowInvites, setAllowInvites] = useState(true);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isRemovingCollaborator, setIsRemovingCollaborator] = useState<
    string | null
  >(null);
  const [isLeavingEvent, setIsLeavingEvent] = useState(false);
  const [showLeaveConfirmDialog, setShowLeaveConfirmDialog] = useState(false);

  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, any>>({});
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showMessageDeleteConfirm, setShowMessageDeleteConfirm] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showMessageDeleteSuccess, setShowMessageDeleteSuccess] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  
  // Script delete confirmation state
  const [showScriptDeleteConfirm, setShowScriptDeleteConfirm] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<any>(null);

  // Invite and collaboration state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<"moderator" | "member">(
    "member"
  );
  const [inviteCode, setInviteCode] = useState<string>("");
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  // Event status management
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Event notes state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [eventNotes, setEventNotes] = useState<string>("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [originalNotes, setOriginalNotes] = useState<string>("");

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<string>("");
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [insightsUsageInfo, setInsightsUsageInfo] = useState<{
    insightsGenerated: number;
    canGenerateMore: boolean;
    weekStart: string;
    maxInsights: number;
  } | null>(null);
  // Attendees stats
  const [attendeesStats, setAttendeesStats] = useState<{ expected_attendees: number; event_attendees: number } | null>(null);
  const [isSavingExpected, setIsSavingExpected] = useState(false);
  const [expectedInput, setExpectedInput] = useState<string>("");
  // Feedback metrics
  const [feedbackMetrics, setFeedbackMetrics] = useState<{ total: number; averageRating: number; positive: number; neutral: number; negative: number } | null>(null);
  // Attendance records
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  // Manual attendance editing
  const [actualInput, setActualInput] = useState<string>("");
  // Public portal modals/links
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showPortalModal, setShowPortalModal] = useState<{ type: 'feedback' | 'attendance' | null, url: string | null }>({ type: null, url: null });
  const [portalModalKey, setPortalModalKey] = useState(0);
  const [isGeneratingPortal, setIsGeneratingPortal] = useState<{ type: 'feedback' | 'attendance' | null }>({ type: null });

  // Markup editing state
  const [isEditingMarkup, setIsEditingMarkup] = useState(false);
  const [editingMarkup, setEditingMarkup] = useState({
    markup_type: "percentage" as "percentage" | "fixed",
    markup_value: 0,
    discount_type: "none" as "none" | "percentage" | "fixed",
    discount_value: 0,
  });
  const [isSavingMarkup, setIsSavingMarkup] = useState(false);

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
    cost: 0.00,
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
  const [showRemoveConfirmDialog, setShowRemoveConfirmDialog] = useState(false);
  const [collaboratorToRemove, setCollaboratorToRemove] = useState<{id: string, name: string} | null>(null);
  const [deleteType, setDeleteType] = useState<"item" | "event">("item");
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  // Event type combobox state
  const eventTypeOptions = [
    'Technology',
    'Music',
    'Food & Drink',
    'Arts & Culture',
    'Business',
    'Gaming',
    'Health',
    'Film',
    'Sports',
    'Other',
  ];
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  useEffect(() => {
    if (event) {
      const loadAll = async () => {
        await Promise.allSettled([
          fetchCollaborators(),
          fetchEventItems(),
          fetchEventScripts(),
          checkUserAccess(),
        ]);
      };
      loadAll();
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
      // Fetch event first
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      console.log("fetchEvent: Event data received:", eventData);
      console.log("fetchEvent: Event creator_id:", eventData?.user_id);

      // Fetch owner's profile separately
      if (eventData?.user_id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("username, fname, lname, avatar_url")
          .eq("id", eventData.user_id)
          .single();

        if (!profileError && profileData) {
          eventData.profiles = profileData;
        }
      }

      setEvent(eventData);
      
      // Set analytics settings from database
      setDataAnalyticsEnabled(eventData?.data_analytics_enabled ?? true);
      setAiChatEnabled(eventData?.ai_chat_enabled ?? false);
      
      // Load existing AI insights from database
      if (eventData?.ai_insights) {
        setAiInsights(eventData.ai_insights);
      }

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
    const date = new Date(dateString);
    // Format date in local time without timezone conversion
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila", // Use Philippines timezone
    };
    return date.toLocaleDateString("en-US", options);
  };

  const handleEventAction = (action: string) => {
    switch (action) {
      case "settings":
        setShowSettingsModal(true);
        break;
      case "chat":
        setShowChat(true);
        break;
      case "invite":
        setShowInviteModal(true);
        break;
      case "notes":
        handleOpenNotes();
        break;
      default:
        break;
    }
  };

  // Load chat messages and subscribe when chat is open
  useEffect(() => {
    let channel: any;
    const loadMessages = async () => {
      if (!showChat || !event) return;
      try {
        const { data, error } = await supabase
          .from("event_chat")
          .select("*")
          .eq("event_id", event.id)
          .order("created_at", { ascending: true });
        if (error) throw error;
        console.log("Loaded chat messages:", data);
        setChatMessages(data || []);

        // Build user cache for message authors
        const ids = [...new Set((data || []).map((m: any) => m.user_id))];
        if (ids.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, fname, lname, avatar_url")
            .in("id", ids);
          if (profiles) {
            const next: Record<string, any> = {};
            for (const p of profiles) next[p.id] = p;
            setUserMap((prev) => ({ ...prev, ...next }));
          }
        }
      } catch (err: any) {
        console.error("Failed to load chat messages", err);
      }

      // Subscribe to new inserts/updates
      channel = supabase
        .channel(`event_chat_${event.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "event_chat",
            filter: `event_id=eq.${event.id}`,
          },
          (payload: any) => {
            setChatMessages((prev) => [...prev, payload.new]);
            const uid = payload.new?.user_id;
            if (uid && !userMap[uid]) {
              supabase
                .from("profiles")
                .select("id, username, fname, lname, avatar_url")
                .eq("id", uid)
                .single()
                .then(({ data }) => {
                  if (data) setUserMap((prev) => ({ ...prev, [uid]: data }));
                });
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "event_chat",
            filter: `event_id=eq.${event.id}`,
          },
          (payload: any) => {
            setChatMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          }
        )
        .subscribe();
    };

    loadMessages();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [showChat, event]);

  // Load attendees stats and feedback metrics
  useEffect(() => {
    (async () => {
      if (!event) return;
      try {
        const { data: att } = await supabase
          .from("attendees")
          .select("expected_attendees, event_attendees")
          .eq("event_id", event.id)
          .maybeSingle();
        if (att) {
          setAttendeesStats(att as any);
          setExpectedInput(String((att as any).expected_attendees ?? 0));
          setActualInput(String((att as any).event_attendees ?? 0));
        }

        const { data: fb } = await supabase
          .from("feedback_responses")
          .select("rating, sentiment, comments, created_at")
          .eq("event_id", event.id);
        if (fb && fb.length > 0) {
          const total = fb.length;
          const ratings = (fb as any[]).map((r) => r.rating).filter((n) => typeof n === 'number');
          const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
          const positive = (fb as any[]).filter((r) => r.sentiment === 'positive').length;
          const neutral = (fb as any[]).filter((r) => r.sentiment === 'neutral').length;
          const negative = (fb as any[]).filter((r) => r.sentiment === 'negative').length;
          setFeedbackMetrics({ total, averageRating: avg, positive, neutral, negative });
        } else {
          setFeedbackMetrics({ total: 0, averageRating: 0, positive: 0, neutral: 0, negative: 0 });
        }

        // Fetch attendance records
        const { data: ar } = await supabase
          .from("attendance_records")
          .select("attendee_name, attendee_email, created_at, note")
          .eq("event_id", event.id);
        setAttendanceRecords(ar || []);
      } catch (e) {
        console.warn('Failed to load attendees/feedback metrics');
      }
    })();
  }, [event]);

  const saveExpectedAttendees = async () => {
    if (!event) return;
    setIsSavingExpected(true);
    try {
      const expected = Math.max(0, parseInt(expectedInput || '0'));
      const { error } = await supabase
        .from('attendees')
        .upsert({ event_id: event.id, expected_attendees: expected }, { onConflict: 'event_id' });
      if (error) throw error;
      setAttendeesStats((prev)=> ({ expected_attendees: expected, event_attendees: prev?.event_attendees ?? 0 }));
      toast.success('Expected attendees updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save expected attendees');
    } finally {
      setIsSavingExpected(false);
    }
  };

  // Generate or reuse a public portal and open modal with URL/QR
  const generatePublicPortal = async (kind: 'feedback' | 'attendance') => {
    // Prevent multiple simultaneous calls
    if (isGeneratingPortal.type) {
      return;
    }
    
    try {
      setIsGeneratingPortal({ type: kind });
      
      if (!event) {
        toast.error('Event not found');
        return;
      }
      
      // Reuse active portal if one exists
      const table = kind === 'feedback' ? 'feedback_portals' : 'attendance_portals';
      // Try reuse any active portal quickly (no ordering to avoid sort cost)
      const { data: existing, error: selErr } = await supabase
        .from(table)
        .select('token')
        .eq('event_id', event.id)
        .eq('is_active', true)
        .limit(1);
      if (selErr) throw selErr;

      let token: string | null = existing && existing.length > 0 ? (existing[0] as any).token : null;

      if (!token) {
        // Create a new portal
        const newToken = Math.random().toString(36).slice(2, 10);
        const insertPayload: any = {
          event_id: event.id,
          token: newToken,
          is_active: true,
          // Provide optional fields to satisfy schema if present
          title: kind === 'feedback' ? `Feedback Portal - ${event.title}` : `Attendance Portal - ${event.title}`,
          description: kind === 'feedback' ? `Feedback collection portal for ${event.title}` : `Attendance check-in portal for ${event.title}`,
          expires_at: null,
        };
        if (currentUserId) insertPayload.created_by = currentUserId;
        const { data: created, error: insErr } = await supabase
          .from(table)
          .insert(insertPayload)
          .select('token')
          .single();
        if (insErr) throw insErr;
        token = created?.token;
      }

      if (!token) throw new Error('Failed to prepare link');
      const url = `${window.location.origin}/${kind === 'feedback' ? 'feedback' : 'checkin'}/${token}`;
      
      // Close any existing modal first
      setShowPortalModal({ type: null, url: null });
      
      // Small delay to ensure state is reset, then open new modal
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Increment key to force remount
      setPortalModalKey((k) => k + 1);
      // Set modal state
      setShowPortalModal({ type: kind, url });
      toast.success(`${kind === 'feedback' ? 'Feedback' : 'Attendance'} link ready`);
    } catch (e: any) {
      console.error('Portal generation failed', e);
      toast.error(e.message || 'Failed to generate link');
      // Ensure modal is closed on error
      setShowPortalModal({ type: null, url: null });
    } finally {
      setIsGeneratingPortal({ type: null });
    }
  };

  const handleSendMessage = async () => {
    if (!event || !newMessage.trim() || isSending) return;
    setIsSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to chat");
      const { error } = await supabase.from("event_chat").insert({
        event_id: event.id,
        user_id: user.id,
        message: newMessage.trim(),
        message_type: "text",
        is_deleted: false,
        is_edited: false,
      });
      if (error) throw error;
      setNewMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!event || deletingMessageId) return;
    setMessageToDelete(messageId);
    setShowMessageDeleteConfirm(true);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    
    setDeletingMessageId(messageToDelete);
    setShowMessageDeleteConfirm(false);
    
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to delete messages");
      
      // Replace the message content with "Message deleted" text
      const { error } = await supabase
        .from("event_chat")
        .update({ 
          message: "Message deleted",
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq("id", messageToDelete);
      
      if (error) throw error;
      
      // Show success dialog
      setShowMessageDeleteSuccess(true);
      
      // Auto-close success dialog after 2 seconds
      setTimeout(() => {
        setShowMessageDeleteSuccess(false);
      }, 2000);
      
    } catch (err: any) {
      toast.error(err.message || "Failed to delete message");
    } finally {
      setDeletingMessageId(null);
      setMessageToDelete(null);
    }
  };

  const cancelDeleteMessage = () => {
    setShowMessageDeleteConfirm(false);
    setMessageToDelete(null);
  };

  // Script deletion functions
  const handleDeleteScript = (script: any) => {
    setScriptToDelete(script);
    setShowScriptDeleteConfirm(true);
  };

  const confirmDeleteScript = async () => {
    if (!scriptToDelete) return;
    
    try {
      // First delete DB record
      const { error: delErr } = await supabase
        .from("event_script")
        .delete()
        .eq("id", scriptToDelete.id);
      if (delErr) throw delErr;

      // Then delete file from storage bucket
      const path = getStoragePathFromPublicUrl(scriptToDelete.file_url, "event-docs");
      if (path) {
        const { error: storageErr } = await supabase.storage
          .from("event-docs")
          .remove([path]);
        if (storageErr) console.warn("Failed to remove from storage:", storageErr);
      }

      toast.success("Deleted script");
      fetchEventScripts();
      setShowScriptDeleteConfirm(false);
      setScriptToDelete(null);
    } catch (err: any) {
      toast.error("Failed to delete");
    }
  };

  const cancelDeleteScript = () => {
    setShowScriptDeleteConfirm(false);
    setScriptToDelete(null);
  };

  // Event Notes functions
  const handleOpenNotes = async () => {
    if (!event || !isOwner) return;
    
    try {
      // Fetch existing notes
      const { data, error } = await supabase
        .from("event_notes")
        .select("notes")
        .eq("event_id", event.id)
        .eq("user_id", event.user_id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      const notes = data?.notes || "";
      setEventNotes(notes);
      setOriginalNotes(notes);
      setShowNotesModal(true);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      toast.error("Failed to load notes");
    }
  };

  const handleSaveNotes = async () => {
    if (!event || !isOwner) return;
    
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from("event_notes")
        .upsert({
          event_id: event.id,
          user_id: event.user_id,
          notes: eventNotes,
        });

      if (error) throw error;

      setOriginalNotes(eventNotes);
      setShowNotesModal(false);
      toast.success("Notes saved successfully!");
    } catch (error: any) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDiscardNotes = () => {
    setEventNotes(originalNotes);
    setShowNotesModal(false);
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
  const updateEventStatusAutomatically = useCallback(async () => {
    if (!event) return;

    const now = new Date();
    const eventDate = new Date(event.date);
    const eventEndDate = new Date(eventDate.getTime() + 6 * 60 * 60 * 1000); // 6 hours after start
    
    // Check if we're past the event date (compare dates, not just times)
    const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isPastEventDate = nowDateOnly > eventDateOnly;

    let newStatus = event.status;

    if (event.status === "coming_soon" && now >= eventDate) {
      newStatus = "ongoing";
    } else if (event.status === "ongoing" && (isPastEventDate || now >= eventEndDate)) {
      // Mark as done if we're past the event date OR if it's been 6+ hours since event start
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
  }, [event]);

  // Auto-update event status periodically
  useEffect(() => {
    if (!event) return;

    // Check immediately
    updateEventStatusAutomatically();

    // Then check every 5 minutes
    const statusInterval = setInterval(() => {
      updateEventStatusAutomatically();
    }, 5 * 60 * 1000);

    return () => clearInterval(statusInterval);
  }, [event, updateEventStatusAutomatically]);

  const handleRemoveCollaborator = async (
    collaboratorId: string,
    collaboratorName: string
  ) => {
    setCollaboratorToRemove({ id: collaboratorId, name: collaboratorName });
    setShowRemoveConfirmDialog(true);
  };

  const confirmRemoveCollaborator = async () => {
    if (!collaboratorToRemove) return;

    setIsRemovingCollaborator(collaboratorToRemove.id);
    try {
      const { error } = await supabase
        .from("event_collaborators")
        .delete()
        .eq("id", collaboratorToRemove.id);

      if (error) throw error;

      // Remove from local state
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorToRemove.id));
      toast.success(`${collaboratorToRemove.name} removed from event successfully!`);
    } catch (error: any) {
      toast.error("Failed to remove collaborator: " + error.message);
    } finally {
      setIsRemovingCollaborator(null);
      setShowRemoveConfirmDialog(false);
      setCollaboratorToRemove(null);
    }
  };

  const cancelRemoveCollaborator = () => {
    setShowRemoveConfirmDialog(false);
    setCollaboratorToRemove(null);
  };

  const handleLeaveEvent = () => {
    setShowLeaveConfirmDialog(true);
  };

  const confirmLeaveEvent = async () => {
    setIsLeavingEvent(true);
    setShowLeaveConfirmDialog(false);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to leave an event");
      }

      // Remove user from event_collaborators table
      const { error } = await supabase
        .from("event_collaborators")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Create notifications for leaving the event
      try {
        console.log("Creating leave event notifications for user:", user.id, "event:", eventId);
        
        // Get event details and user profile for notifications
        const { data: eventData } = await supabase
          .from('events')
          .select('title, user_id')
          .eq('id', eventId)
          .single();

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('fname, lname, username')
          .eq('id', user.id)
          .single();

        console.log("Event data:", eventData);
        console.log("User profile:", userProfile);

        if (eventData) {
          const userName = userProfile?.fname && userProfile?.lname 
            ? `${userProfile.fname} ${userProfile.lname}`
            : userProfile?.username || 'Someone';

          // Notification for the user who left
          const leaverNotification = {
            user_id: user.id,
            type: "event_left",
            title: "Left Event Successfully",
            message: `You have successfully left "${eventData.title}".`,
            event_id: eventId,
            link_url: `/events`,
            metadata: { event_title: eventData.title }
          };
          
          console.log("Creating leaver notification:", leaverNotification);
          const { data: leaverNotifData, error: leaverNotifError } = await supabase
            .from("notifications")
            .insert(leaverNotification)
            .select();
          
          if (leaverNotifError) {
            console.error("Leaver notification error:", leaverNotifError);
          } else {
            console.log("Leaver notification created:", leaverNotifData);
          }

          // Notification for the event owner (if different from leaver)
          if (eventData.user_id !== user.id) {
            const ownerNotification = {
              user_id: eventData.user_id,
              type: "event_left",
              title: "Member Left Event",
              message: `${userName} has left your event "${eventData.title}".`,
              event_id: eventId,
              link_url: `/event/${eventId}`,
              metadata: { 
                leaver_id: user.id,
                leaver_name: userName,
                event_title: eventData.title
              }
            };
            
            console.log("Creating owner notification:", ownerNotification);
            const { data: ownerNotifData, error: ownerNotifError } = await supabase
              .from("notifications")
              .insert(ownerNotification)
              .select();
            
            if (ownerNotifError) {
              console.error("Owner notification error:", ownerNotifError);
            } else {
              console.log("Owner notification created:", ownerNotifData);
            }
          }
        }
      } catch (notifError) {
        console.error("Failed to create leave event notifications:", notifError);
        // Don't fail the leave process if notification fails
      }

      toast.success("You have successfully left the event!");
      
      // Redirect to events page
      router.push("/events");
    } catch (error: any) {
      toast.error("Failed to leave event: " + error.message);
    } finally {
      setIsLeavingEvent(false);
    }
  };

  const handleToggleAiChat = async () => {
    if (!event) return;
    
    const newValue = !aiChatEnabled;
    setAiChatEnabled(newValue);
    
    try {
      const { error } = await supabase
        .from("events")
        .update({ ai_chat_enabled: newValue })
        .eq("id", event.id);
        
      if (error) throw error;
      
      toast.info(`AI Chat ${newValue ? "enabled" : "disabled"}`);
    } catch (error: any) {
      // Revert on error
      setAiChatEnabled(!newValue);
      toast.error("Failed to update AI chat settings");
    }
  };

  const handleToggleDataAnalytics = async () => {
    if (!event) return;
    
    const newValue = !dataAnalyticsEnabled;
    setDataAnalyticsEnabled(newValue);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from("events")
        .update({ data_analytics_enabled: newValue })
        // Allow owner updates; RLS should still enforce
        .eq('id', event.id)
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      toast.info(
        `Data Analytics ${newValue ? "enabled" : "disabled"}`
      );
    } catch (error: any) {
      // Revert on error
      setDataAnalyticsEnabled(!newValue);
      console.error("Failed to update analytics settings:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      toast.error(error?.message || "Failed to update analytics settings");
    }
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
          max_uses: 20,
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
        cost: newItem.cost,
      });

      const { data, error } = await supabase
        .from("event_items")
        .insert({
          event_id: event.id,
          item_name: newItem.item_name.trim(),
          item_description: newItem.item_description.trim(),
          item_quantity: newItem.item_quantity,
          cost: newItem.cost,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Item inserted successfully:", data);
      setEventItems((prev) => [...prev, data]);
      setNewItem({ item_name: "", item_description: "", item_quantity: 1, cost: 0.00 });
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
      cost: item.cost || 0.00,
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
        cost: newItem.cost,
      });

      const { error } = await supabase
        .from("event_items")
        .update({
          item_name: newItem.item_name.trim(),
          item_description: newItem.item_description.trim(),
          item_quantity: newItem.item_quantity,
          cost: newItem.cost,
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
                cost: newItem.cost,
              }
            : item
        )
      );

      setNewItem({ item_name: "", item_description: "", item_quantity: 1, cost: 0.00 });
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
    setNewItem({ item_name: "", item_description: "", item_quantity: 1, cost: 0.00 });
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

      // Set current user ID for chat message ownership checks
      setCurrentUserId(user.id);

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
  setIsTypeMenuOpen(false);
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
          date: editingEvent.date ? new Date(editingEvent.date).toISOString() : null,
          location: editingEvent.location.trim(),
          category: editingEvent.type.trim(),
        })
        .eq("id", eventId)
        .select()
        .single();

      if (error) throw error;

      // Update attendees (expected and actual) if changed
      const expected = Math.max(0, parseInt(expectedInput || '0'));
      const actual = Math.max(0, parseInt(actualInput || '0'));
      const prevExpected = attendeesStats?.expected_attendees ?? 0;
      const prevActual = attendeesStats?.event_attendees ?? 0;
      if (expected !== prevExpected || actual !== prevActual) {
        const { error: attendeesError } = await supabase
          .from('attendees')
          .upsert({ event_id: eventId, expected_attendees: expected, event_attendees: actual }, { onConflict: 'event_id' });
        if (attendeesError) {
          console.error('Error updating attendees:', attendeesError);
        } else {
          setAttendeesStats({ expected_attendees: expected, event_attendees: actual });
        }
      }

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

  // Analytics functions
  const generateAnalyticsData = () => {
    if (!event || !eventItems) return null;

    const totalItemCost = eventItems.length > 0 ? eventItems.reduce((sum, item) => sum + ((item.cost || 0) * (item.item_quantity || 1)), 0) : 0;
    const totalQuantity = eventItems.length > 0 ? eventItems.reduce((sum, item) => sum + (item.item_quantity || 0), 0) : 0;
    const itemCount = eventItems.length;
    const memberCount = collaborators.length + 1; // +1 for owner

    // Calculate markup amount
    let markupAmount = 0;
    if (event.markup_type === "percentage") {
      markupAmount = totalItemCost * (event.markup_value / 100);
    } else if (event.markup_type === "fixed") {
      markupAmount = event.markup_value;
    }

    // Calculate price after markup
    const priceAfterMarkup = totalItemCost + markupAmount;

    // Calculate discount amount
    let discountAmount = 0;
    if (event.discount_type === "percentage") {
      discountAmount = priceAfterMarkup * (event.discount_value / 100);
    } else if (event.discount_type === "fixed") {
      discountAmount = event.discount_value;
    }

    // Final event price
    const finalEventPrice = Math.max(0, priceAfterMarkup - discountAmount);

    // Profit calculations
    const grossProfit = finalEventPrice - totalItemCost;
    const profitMargin = finalEventPrice > 0 ? (grossProfit / finalEventPrice) * 100 : 0;

    // Statistical analysis of item costs
    const itemCosts = eventItems.map(item => item.cost || 0).sort((a, b) => a - b);
    const itemQuantities = eventItems.map(item => item.item_quantity || 0).sort((a, b) => a - b);
    
    // Calculate mean, median, mode for costs
    const meanCost = itemCount > 0 ? totalItemCost / itemCount : 0;
    const medianCost = itemCount > 0 ? 
      (itemCount % 2 === 0 ? 
        (itemCosts[itemCount / 2 - 1] + itemCosts[itemCount / 2]) / 2 : 
        itemCosts[Math.floor(itemCount / 2)]
      ) : 0;
    
    // Calculate mode (most frequent cost)
    const costFrequency = itemCosts.length > 0 ? itemCosts.reduce((acc, cost) => {
      acc[cost] = (acc[cost] || 0) + 1;
      return acc;
    }, {} as Record<number, number>) : {};
    const modeCost = Object.keys(costFrequency).length > 0 ? 
      Object.entries(costFrequency).reduce((a, b) => 
      costFrequency[Number(a[0])] > costFrequency[Number(b[0])] ? a : b
      )[0] : 0;

    // Calculate standard deviation
    const variance = itemCount > 0 ? 
      itemCosts.reduce((sum, cost) => sum + Math.pow(cost - meanCost, 2), 0) / itemCount : 0;
    const standardDeviation = Math.sqrt(variance);

    // Calculate min, max, range
    const minCost = itemCosts.length > 0 ? itemCosts[0] : 0;
    const maxCost = itemCosts.length > 0 ? itemCosts[itemCosts.length - 1] : 0;
    const costRange = maxCost - minCost;

    // Quantity statistics
    const meanQuantity = itemCount > 0 ? totalQuantity / itemCount : 0;
    const medianQuantity = itemCount > 0 ? 
      (itemCount % 2 === 0 ? 
        (itemQuantities[itemCount / 2 - 1] + itemQuantities[itemCount / 2]) / 2 : 
        itemQuantities[Math.floor(itemCount / 2)]
      ) : 0;

    // Cost distribution by category (for reference, but we'll use stats instead)
    const costByCategory = eventItems.length > 0 ? eventItems.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + (item.cost || 0);
      return acc;
    }, {} as Record<string, number>) : {};

    // Quantity distribution
    const quantityData = eventItems.map(item => ({
      name: item.item_name,
      quantity: item.item_quantity || 0,
      cost: item.cost || 0
    }));

    // Cost trend (simulated based on item count)
    const costTrend = eventItems.length > 0 ? eventItems.map((item, index) => ({
      item: `Item ${index + 1}`,
      cost: item.cost || 0,
      cumulative: eventItems.slice(0, index + 1).reduce((sum, i) => sum + (i.cost || 0), 0)
    })) : [];

    // Descriptive analysis
    const getCostDistributionDescription = () => {
      if (standardDeviation === 0) return "All items have the same cost";
      if (standardDeviation < meanCost * 0.1) return "Costs are very consistent";
      if (standardDeviation < meanCost * 0.3) return "Costs are moderately consistent";
      return "Costs vary significantly";
    };

    const getQuantityDistributionDescription = () => {
      const quantityRange = Math.max(...itemQuantities) - Math.min(...itemQuantities);
      if (quantityRange === 0) return "All items have the same quantity";
      if (quantityRange <= 2) return "Quantities are very similar";
      if (quantityRange <= 5) return "Quantities are moderately varied";
      return "Quantities vary significantly";
    };

    return {
      totalItemCost,
      totalQuantity,
      itemCount,
      memberCount,
      markupAmount,
      discountAmount,
      finalEventPrice,
      grossProfit,
      profitMargin,
      // attendance - enhanced with attendance records
      expectedAttendees: attendeesStats?.expected_attendees ?? 0,
      actualAttendees: attendeesStats?.event_attendees ?? 0,
      attendanceRecordsCount: attendanceRecords.length,
      attendanceRate: (attendeesStats && (attendeesStats.expected_attendees ?? 0) > 0)
        ? ((attendeesStats.event_attendees ?? 0) / (attendeesStats.expected_attendees ?? 1)) * 100
        : 0,
      attendanceRecordsRate: (attendeesStats && (attendeesStats.expected_attendees ?? 0) > 0)
        ? (attendanceRecords.length / (attendeesStats.expected_attendees ?? 1)) * 100
        : 0,
      costByCategory,
      quantityData,
      costTrend,
      averageCostPerItem: itemCount > 0 ? totalItemCost / itemCount : 0,
      averageCostPerMember: memberCount > 0 ? totalItemCost / memberCount : 0,
      averagePricePerMember: memberCount > 0 ? finalEventPrice / memberCount : 0,
      // Enhanced feedback analytics
      feedbackMetrics: feedbackMetrics || { total: 0, averageRating: 0, positive: 0, neutral: 0, negative: 0 },
      feedbackResponseRate: (attendeesStats && (attendeesStats.expected_attendees ?? 0) > 0)
        ? ((feedbackMetrics?.total ?? 0) / (attendeesStats.expected_attendees ?? 1)) * 100
        : 0,
      // Attendance records analytics
      attendanceRecords: attendanceRecords,
      // Statistical data
      statistics: {
        cost: {
          mean: meanCost,
          median: medianCost,
          mode: Number(modeCost),
          min: minCost,
          max: maxCost,
          range: costRange,
          standardDeviation,
          variance,
          description: getCostDistributionDescription()
        },
        quantity: {
          mean: meanQuantity,
          median: medianQuantity,
          min: itemQuantities.length > 0 ? itemQuantities[0] : 0,
          max: itemQuantities.length > 0 ? itemQuantities[itemQuantities.length - 1] : 0,
          range: itemQuantities.length > 0 ? itemQuantities[itemQuantities.length - 1] - itemQuantities[0] : 0,
          description: getQuantityDistributionDescription()
        }
      }
    };
  };

  const fetchInsightsUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's subscription to determine AI insights limits
      await DefaultSubscriptionManager.ensureUserHasSubscription(user.id);
      
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
        return;
      }

      const planName = (subscription?.subscription_plans as any)?.name || "Free Tier";
      const subscriptionFeatures = DefaultSubscriptionManager.getSubscriptionFeatures(planName);
      const maxAIInsightsPerEvent = subscriptionFeatures.max_ai_insights_per_event;

      // Get total insights generated for this event this week (shared across all participants)
      const { data, error } = await supabase.rpc('get_event_insights_weekly_usage', {
        p_event_id: eventId
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const usage = data[0];
        setInsightsUsageInfo({
          insightsGenerated: usage.total_insights_generated || 0,
          canGenerateMore: (usage.total_insights_generated || 0) < maxAIInsightsPerEvent,
          weekStart: usage.week_start_date_return,
          maxInsights: maxAIInsightsPerEvent
        });
      } else {
        // If no data, set default values
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
        weekStart.setHours(0, 0, 0, 0);
        
        setInsightsUsageInfo({
          insightsGenerated: 0,
          canGenerateMore: 0 < maxAIInsightsPerEvent,
          weekStart: weekStart.toISOString().split('T')[0],
          maxInsights: maxAIInsightsPerEvent
        });
      }
    } catch (error) {
      console.error('Error fetching insights usage info:', error);
    }
  };

  const incrementInsightsUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Increment the shared event insights count
      const { error } = await supabase.rpc('increment_event_insights_usage', {
        p_event_id: eventId,
        p_week_start_date: insightsUsageInfo?.weekStart
      });

      if (error) throw error;

      // Update local state
      setInsightsUsageInfo(prev => prev ? {
        ...prev,
        insightsGenerated: prev.insightsGenerated + 1,
        canGenerateMore: prev.insightsGenerated + 1 < 5
      } : null);
    } catch (error) {
      console.error('Error incrementing insights usage:', error);
    }
  };

  const saveInsightsToDatabase = async (insights: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('events')
        .update({
          ai_insights: insights,
          insights_generated_at: new Date().toISOString(),
          insights_generated_by: user.id
        })
        .eq('id', eventId);

      if (error) throw error;
      
      console.log('Insights saved to database successfully');
    } catch (error) {
      console.error('Error saving insights to database:', error);
    }
  };

  const generateAIInsights = async () => {
    if (!event || !eventItems) return;
    
    // If usage info is not loaded yet, fetch it first
    if (!insightsUsageInfo) {
      await fetchInsightsUsage();
      return; // Will retry after usage info is loaded
    }
    
    // Check if user can generate more insights
    if (!insightsUsageInfo.canGenerateMore) return;

    setIsGeneratingInsights(true);
    try {
      // Increment usage counter
      await incrementInsightsUsage();
      
      // Add AI delay based on subscription tier
      await addAIDelay();
      
      const analytics = generateAnalyticsData();
      if (!analytics) return;

      const prompt = `Analyze this event's data and write a detailed descriptive analysis summary:

Event: ${event.title}
Category: ${event.category}
Date: ${event.date}
Members: ${analytics.memberCount}
Items: ${analytics.itemCount}

PRICING BREAKDOWN:
- Total Item Cost: PHP ${analytics.totalItemCost.toFixed(2)}
- Markup (${event.markup_type === 'percentage' ? `${event.markup_value}%` : `PHP ${event.markup_value}`}): PHP ${analytics.markupAmount.toFixed(2)}
- Price After Markup: PHP ${(analytics.totalItemCost + analytics.markupAmount).toFixed(2)}
${event.discount_type !== 'none' ? `- Discount (${event.discount_type === 'percentage' ? `${event.discount_value}%` : `PHP ${event.discount_value}`}): PHP ${analytics.discountAmount.toFixed(2)}` : ''}
- Final Event Price: PHP ${analytics.finalEventPrice.toFixed(2)}
- Gross Profit: PHP ${analytics.grossProfit.toFixed(2)}
- Profit Margin: ${analytics.profitMargin.toFixed(1)}%

STATISTICAL ANALYSIS:
Cost Statistics:
- Mean Cost: PHP ${analytics.statistics.cost.mean.toFixed(2)}
- Median Cost: PHP ${analytics.statistics.cost.median.toFixed(2)}
- Mode Cost: PHP ${analytics.statistics.cost.mode.toFixed(2)}
- Min Cost: PHP ${analytics.statistics.cost.min.toFixed(2)}
- Max Cost: PHP ${analytics.statistics.cost.max.toFixed(2)}
- Cost Range: PHP ${analytics.statistics.cost.range.toFixed(2)}
- Standard Deviation: PHP ${analytics.statistics.cost.standardDeviation.toFixed(2)}
- Cost Distribution: ${analytics.statistics.cost.description}

Quantity Statistics:
- Mean Quantity: ${analytics.statistics.quantity.mean.toFixed(1)} units
- Median Quantity: ${analytics.statistics.quantity.median.toFixed(1)} units
- Min Quantity: ${analytics.statistics.quantity.min} units
- Max Quantity: ${analytics.statistics.quantity.max} units
- Quantity Range: ${analytics.statistics.quantity.range} units
- Quantity Distribution: ${analytics.statistics.quantity.description}

Item Details:
${eventItems.map(item => `- ${item.item_name}: ${item.item_quantity} units, PHP ${(item.cost || 0).toFixed(2)}`).join('\n')}

ATTENDANCE ANALYSIS:
- Expected Attendees: ${analytics.expectedAttendees}
- Actual Attendees: ${analytics.actualAttendees}
- Attendance Records: ${analytics.attendanceRecordsCount}
- Attendance Rate: ${analytics.attendanceRate.toFixed(1)}%
- Attendance Records Rate: ${analytics.attendanceRecordsRate.toFixed(1)}%

FEEDBACK ANALYSIS:
- Total Feedback Responses: ${analytics.feedbackMetrics.total}
- Average Rating: ${analytics.feedbackMetrics.averageRating.toFixed(1)}/5
- Positive Feedback: ${analytics.feedbackMetrics.positive}
- Neutral Feedback: ${analytics.feedbackMetrics.neutral}
- Negative Feedback: ${analytics.feedbackMetrics.negative}
- Feedback Response Rate: ${analytics.feedbackResponseRate.toFixed(1)}%

Write 5 short paragraphs (1–3 sentences each), with bold labels, no lists:
1) **Overview**: key takeaways across pricing, attendance, feedback.
2) **Pricing Analysis**: interpret costs, markup/discount impact, margin.
3) **Attendance Analysis**: expected vs actual, engagement signals.
4) **Feedback Signals**: average rating and sentiment patterns.
5) **Risks & Recommendations**: 2–3 prioritized actions.
Constraints: 150–220 words total, no extra blank lines, no tables.`;

      // Initialize Cohere client
      const cohere = new CohereClientV2({
        token: process.env.NEXT_PUBLIC_COHERE_API_KEY || 'TbnKkS2gKZIx4enseFsd5KIvfpnxqDhSmqK2pVmA',
      });

      // Use the new chat API
      const response = await cohere.chat({
        model: 'command-a-03-2025',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        maxTokens: 450,
        temperature: 0.65,
      });

      if (response.message && response.message.content && response.message.content[0]) {
        const content = response.message.content[0];
        if ('text' in content) {
          // post-process: collapse extra blank lines and strip leading headings
          const raw = content.text || '';
          const collapsed = raw
            .replace(/\n{2,}/g, '\n')
            .replace(/^\s*#{1,6}\s*/gm, '')
            .trim();
          setAiInsights(collapsed);
          
          // Save insights to database
          await saveInsightsToDatabase(collapsed);
        } else {
          throw new Error('Invalid response format from AI service');
        }
      } else {
        throw new Error('Invalid response from AI service');
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
      
      // Provide fallback insights when API fails
      const fallbackAnalytics = generateAnalyticsData();
      if (fallbackAnalytics) {
        const fallbackInsights = `SUMMARY: ${event.title} · Items ${fallbackAnalytics.itemCount}, Members ${fallbackAnalytics.memberCount}
- Final price PHP ${fallbackAnalytics.finalEventPrice.toFixed(2)}, Profit margin ${fallbackAnalytics.profitMargin.toFixed(1)}%
- Attendance rate ${fallbackAnalytics.attendanceRate.toFixed(1)}%, Feedback ${fallbackAnalytics.feedbackMetrics.averageRating.toFixed(1)}/5
PRICING:
- Total item cost PHP ${fallbackAnalytics.totalItemCost.toFixed(2)}; markup/discount applied
- Gross profit PHP ${fallbackAnalytics.grossProfit.toFixed(2)}
ATTENDANCE:
- Expected ${fallbackAnalytics.expectedAttendees}; records ${fallbackAnalytics.attendanceRecordsCount}
FEEDBACK:
- ${fallbackAnalytics.feedbackMetrics.total} responses; +${fallbackAnalytics.feedbackMetrics.positive}/-${fallbackAnalytics.feedbackMetrics.negative}
RECOMMENDATIONS:
- Optimize high-cost items; validate supplier quotes
- Align markup with target margin; avoid underpricing
- Promote earlier to raise attendance; streamline check-in
- Close feedback loop; fix top 1–2 pain points`;
        
        setAiInsights(fallbackInsights);
        
        // Save fallback insights to database
        await saveInsightsToDatabase(fallbackInsights);
      } else {
        const errorMessage = 'Unable to generate AI insights at this time. Please try again later.';
        setAiInsights(errorMessage);
        
        // Save error message to database
        await saveInsightsToDatabase(errorMessage);
      }
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleShowAnalytics = () => {
    const data = generateAnalyticsData();
    setAnalyticsData(data);
    setShowAnalytics(true);
    // Fetch insights usage when analytics opens
    fetchInsightsUsage();
  };

  // Fetch insights usage when analytics modal opens
  useEffect(() => {
    if (showAnalytics && !insightsUsageInfo) {
      fetchInsightsUsage();
    }
  }, [showAnalytics, insightsUsageInfo]);

  // Markup editing functions
  const handleEditMarkup = () => {
    if (!event) return;
    setEditingMarkup({
      markup_type: event.markup_type,
      markup_value: event.markup_value,
      discount_type: event.discount_type,
      discount_value: event.discount_value,
    });
    setIsEditingMarkup(true);
  };

  const handleSaveMarkup = async () => {
    if (!event) return;
    setIsSavingMarkup(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          markup_type: editingMarkup.markup_type,
          markup_value: editingMarkup.markup_value,
          discount_type: editingMarkup.discount_type,
          discount_value: editingMarkup.discount_value,
        })
        .eq("id", event.id);

      if (error) throw error;

      // Update local state
      setEvent({
        ...event,
        markup_type: editingMarkup.markup_type,
        markup_value: editingMarkup.markup_value,
        discount_type: editingMarkup.discount_type,
        discount_value: editingMarkup.discount_value,
      });

      setIsEditingMarkup(false);
      toast.success("Markup and discount updated successfully!");
    } catch (error: any) {
      toast.error("Failed to update markup: " + error.message);
    } finally {
      setIsSavingMarkup(false);
    }
  };

  const handleCancelMarkupEdit = () => {
    setIsEditingMarkup(false);
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
        <div className="w-full px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Link href="/events">
              <Button variant="ghost" className="text-white hover:bg-slate-700 w-full sm:w-auto justify-start">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
            </Link>
            <div className="hidden sm:block h-6 w-px bg-slate-600" />
            <h1 className="text-xl sm:text-2xl font-semibold text-white text-center sm:text-left">Event Details</h1>
          </div>
        </div>
      </div>

      {/* Main Content with gutter */}
      <div className="w-full py-8 pr-3">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
          {/* Main Content Area - Takes 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            {/* Event Title */}
            <div className="text-center">
              {isEditingEvent ? (
                <div className="space-y-4 px-2 sm:px-3 md:px-4">
                  <Input
                    value={editingEvent.title}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        title: e.target.value,
                      })
                    }
                    className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-center bg-slate-800 border-amber-500/30 text-white h-12 sm:h-14 md:h-16"
                    placeholder="Event Title"
                  />
                  <div className="flex flex-col max-[855px]:flex-col min-[856px]:flex-row min-[856px]:items-center min-[856px]:justify-center gap-3 min-[856px]:gap-4 text-slate-300 text-sm mb-6">
                    <div className="flex items-center gap-1 w-full min-[856px]:w-auto">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <Input
                        type="datetime-local"
                        value={
                          editingEvent.date
                            ? (() => {
                                const date = new Date(editingEvent.date);
                                // Get local date/time without timezone conversion
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const hours = String(date.getHours()).padStart(2, '0');
                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                return `${year}-${month}-${day}T${hours}:${minutes}`;
                              })()
                            : ""
                        }
                        onChange={(e) =>
                          setEditingEvent({
                            ...editingEvent,
                            date: e.target.value,
                          })
                        }
                        className="bg-slate-800 border-amber-500/30 text-white text-xs sm:text-sm w-full min-[856px]:w-auto h-9 sm:h-10"
                      />
                    </div>
                    <div className="flex items-center gap-1 w-full min-[856px]:w-auto">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <Input
                        value={editingEvent.location}
                        onChange={(e) =>
                          setEditingEvent({
                            ...editingEvent,
                            location: e.target.value,
                          })
                        }
                        placeholder="Location"
                        className="bg-slate-800 border-amber-500/30 text-white text-xs sm:text-sm w-full min-[856px]:w-auto h-9 sm:h-10"
                      />
                    </div>
                    <div className="flex items-center gap-1 relative w-full min-[856px]:w-auto">
                      <Input
                        value={editingEvent.type}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditingEvent({
                            ...editingEvent,
                            type: e.target.value,
                          })
                        }
                        placeholder="Type"
                        onFocus={() => setIsTypeMenuOpen(true)}
                        className="bg-slate-800 border-amber-500/30 text-white text-xs sm:text-sm w-full min-[856px]:w-auto pr-8 h-9 sm:h-10"
                      />
                      {/* Dropdown trigger indicator */}
                      <button
                        type="button"
                        aria-label="Toggle event type options"
                        onClick={() => setIsTypeMenuOpen((o) => !o)}
                        className="absolute right-1.5 p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
                      </button>
                      {/* Choices dropdown with filtering */}
                      {isTypeMenuOpen && (
                        <div className="absolute top-full mt-1 left-0 z-20 w-56 bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-72 overflow-auto">
                          {eventTypeOptions
                            .filter((opt) =>
                              (editingEvent.type || '').trim() === ''
                                ? true
                                : opt.toLowerCase().includes(editingEvent.type.toLowerCase())
                            )
                            .map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${editingEvent.type === opt ? 'text-white' : 'text-slate-300'}`}
                                onClick={() => {
                                  setEditingEvent({ ...editingEvent, type: opt });
                                  setIsTypeMenuOpen(false);
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          {(editingEvent.type || '').trim() === '' && (
                            <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-700">
                              You can also type a custom type.
                    </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 break-words">
                    {event.title}
                  </h1>
                    {canEdit && (
                    <div className="flex justify-center sm:justify-end mb-3 px-4 sm:px-0">
                      <Button
                        variant="ghost"
                        onClick={handleEditEvent}
                        className="border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 w-full sm:w-auto max-w-xs sm:max-w-none"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Event
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-slate-300 text-sm mb-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Type:</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-200">
                        {event.category}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Event Image */}
            <div className="relative w-full h-64 sm:h-72 md:h-80 rounded-lg overflow-hidden bg-slate-700 mx-2 sm:mx-3 md:mx-4">
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

            {/* Event Description */}
            <div className="rounded-lg p-4 sm:p-6">
              <h3 className="text-xl font-semibold text-amber-400 mb-2">
                Event Description
              </h3>
              <div className="mb-4">
                {isEditingEvent ? (
                  <div className="space-y-3">
                    <label className="text-amber-300 text-sm font-medium">
                      Expected Event Participant:
                    </label>
                    <Input
                      type="number"
                      value={expectedInput}
                      onChange={(e) => setExpectedInput(e.target.value)}
                      placeholder="Enter expected participants"
                      className="bg-slate-800 border-amber-500/30 text-white w-32"
                    />

                    <label className="text-amber-300 text-sm font-medium">
                      Actual Event Participant:
                    </label>
                    <Input
                      type="number"
                      value={actualInput}
                      onChange={(e) => setActualInput(e.target.value)}
                      placeholder="Enter actual participants"
                      className="bg-slate-800 border-amber-500/30 text-white w-32"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-amber-300 text-sm font-medium">
                      Expected Event Participant: {attendeesStats?.expected_attendees || 'Not specified'}
                    </p>
                    <p className="text-amber-300 text-sm font-medium">
                      Actual Event Participant: {attendeesStats?.event_attendees ?? 0}
                    </p>
                  </div>
                )}
              </div>
              <div className="mb-4 pt-3 border-t border-amber-500/20">
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
            </div>

            {/* Save/Cancel Buttons - Only show when editing */}
            {isEditingEvent && (
              <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4 sm:px-0 mt-6">
                <Button
                  variant="ghost"
                  onClick={handleSaveEvent}
                  className="border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 w-full sm:w-auto"
                >
                  Save Changes
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancelEditEvent}
                  className="border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Event Items Management */}
            <div className="p-4 sm:p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Event Items
                </h3>
                
                {/* Pricing Summary - Always Show */}
                {(() => {
                  const analytics = generateAnalyticsData();
                  return (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-600 overflow-hidden mb-6">
                      <div className="flex items-center justify-between p-3 bg-slate-700/50 border-b border-slate-600">
                        <h4 className="text-slate-300 text-sm font-medium">Pricing Summary</h4>
                        {isOwner && !isEditingMarkup && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEditMarkup}
                            className="text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[500px]">
                        <thead>
                          <tr className="bg-slate-700/30">
                            <th className="text-left p-3 text-slate-300 text-sm font-medium">Total Item Cost</th>
                            <th className="text-left p-3 text-slate-300 text-sm font-medium">Markup</th>
                            <th className="text-left p-3 text-slate-300 text-sm font-medium">Discount</th>
                            <th className="text-left p-3 text-slate-300 text-sm font-medium">Total Event Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-3">
                              <div className="text-green-400 text-lg font-bold">
                                PHP {analytics?.totalItemCost.toFixed(2) || '0.00'}
                              </div>
                            </td>
                            <td className="p-3">
                              {isEditingMarkup ? (
                                <div className="space-y-2">
                                  <Select
                                    value={editingMarkup.markup_type}
                                    onValueChange={(value: "percentage" | "fixed") =>
                                      setEditingMarkup(prev => ({ ...prev, markup_type: value }))
                                    }
                                  >
                                    <SelectTrigger className="w-24 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="percentage">%</SelectItem>
                                      <SelectItem value="fixed">PHP</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editingMarkup.markup_value}
                                    onChange={(e) =>
                                      setEditingMarkup(prev => ({ ...prev, markup_value: parseFloat(e.target.value) || 0 }))
                                    }
                                    className="w-20 h-8"
                                  />
                                </div>
                              ) : (
                                <div className="text-blue-400 text-lg font-bold">
                                  {event.markup_type === 'percentage' ? `${event.markup_value}%` : `PHP ${event.markup_value}`}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {isEditingMarkup ? (
                                <div className="space-y-2">
                                  <Select
                                    value={editingMarkup.discount_type}
                                    onValueChange={(value: "none" | "percentage" | "fixed") =>
                                      setEditingMarkup(prev => ({ ...prev, discount_type: value }))
                                    }
                                  >
                                    <SelectTrigger className="w-24 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      <SelectItem value="percentage">%</SelectItem>
                                      <SelectItem value="fixed">PHP</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {editingMarkup.discount_type !== 'none' && (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editingMarkup.discount_value}
                                      onChange={(e) =>
                                        setEditingMarkup(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))
                                      }
                                      className="w-20 h-8"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="text-red-400 text-lg font-bold">
                                  {event.discount_type === 'none' ? 'None' : 
                                   event.discount_type === 'percentage' ? `${event.discount_value}%` : `PHP ${event.discount_value}`}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="text-purple-400 text-xl font-bold">
                                PHP {analytics?.finalEventPrice.toFixed(2) || '0.00'}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                      {isEditingMarkup && (
                        <div className="p-3 bg-slate-700/30 border-t border-slate-600 flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelMarkupEdit}
                            disabled={isSavingMarkup}
                            className="border border-red-500 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveMarkup}
                            disabled={isSavingMarkup}
                            className="border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                          >
                            {isSavingMarkup ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Changes'
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Add New Item Box (only editors) */}
                {canEdit && (
                  <div
                    onClick={() => setShowAddForm(true)}
                    className="border-2 border-dashed border-green-500/50 rounded-lg p-6 text-center cursor-pointer hover:border-green-500/70 hover:bg-green-500/5 transition-all h-52 flex flex-col items-center justify-center bg-slate-700/50"
                  >
                    <Plus className="w-12 h-12 text-green-500 mb-3" />
                    <div className="text-green-500 text-lg font-semibold mb-2">
                      Add New Item
                    </div>
                    <div className="text-green-400/70 text-sm">
                      Click to add items to this event
                    </div>
                  </div>
                )}

                {/* Existing Items (view for all; actions only for editors) */}
                {(() => {
                  // Show 7 items initially, then hide the rest
                  const maxItemsInitial = 7;
                  const itemsToShow = showAllItems ? eventItems : eventItems.slice(0, maxItemsInitial);
                  const hasMoreItems = eventItems.length > maxItemsInitial;
                  
                  return (
                    <>
                      {itemsToShow.map((item, index) => (
                  <div
                    key={item.id}
                          className="bg-slate-700/50 border border-green-500/30 rounded-lg p-4 h-48 sm:h-52 relative flex flex-col"
                  >
                    {/* Action Buttons - Top Right (editors only) */}
                    {canEdit && (
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
                    )}

                    {/* Content */}
                    <div className="pt-8 flex-1 flex flex-col">
                      <div className="text-green-400 text-lg font-semibold mb-2 truncate">
                        {item.item_name}
                      </div>
                      <div
                        className="text-slate-300 text-sm mb-3 overflow-hidden flex-1"
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
                      <div className="space-y-2 mt-auto">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs font-medium">
                          Quantity:
                        </span>
                          <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                          {item.item_quantity}
                        </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs font-medium">
                            Cost:
                          </span>
                          <span className="text-green-400 text-xs font-bold">
                            PHP {(item.cost || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                      
                      {/* See More Button */}
                      {hasMoreItems && !showAllItems && (
                        <div className="col-span-full flex justify-center mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setShowAllItems(true)}
                            className="border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                          >
                            See More ({eventItems.length - maxItemsInitial} more items)
                          </Button>
                        </div>
                      )}
                      
                      {/* Show Less Button */}
                      {hasMoreItems && showAllItems && (
                        <div className="col-span-full flex justify-center mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setShowAllItems(false)}
                            className="border-slate-500/30 text-slate-400 hover:bg-slate-500/20 hover:text-slate-300"
                          >
                            Show Less
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Event Script */}
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Event Script</h3>
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-amber-400 mb-3">
                    Event Script
                  </h4>
                  {canEdit && (
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
                        <div key={s.id} className="flex bg-slate-800/60 border border-slate-600 rounded-md p-3 items-center justify-between max-[450px]:flex-col max-[450px]:items-start max-[450px]:gap-2">
                          <div className="min-w-0 w-full">
                            <div className="text-white font-medium truncate">{s.file_name}</div>
                            <div className="text-slate-400 text-xs">{s.mime_type} • {(s.file_size || 0) / 1024 | 0} KB</div>
                          </div>
                          <div className="flex items-center gap-2 max-[450px]:w-full max-[450px]:justify-end max-[450px]:flex-wrap">
                            <Button
                              variant="outline"
                              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20 flex items-center gap-1"
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
                              <span className="sm:hidden"><FileText className="w-4 h-4" /></span>
                              <span className="hidden sm:inline">Preview</span>
                            </Button>
                            {/* Download button */}
                            <Button
                              variant="outline"
                              className="border-slate-500/40 text-slate-200 hover:bg-slate-500/20 flex items-center gap-1"
                              onClick={async () => {
                                try {
                                  // Force download by fetching as Blob and creating an object URL
                                  const res = await fetch(s.file_url, { mode: 'cors' });
                                  if (!res.ok) throw new Error('Network error');
                                  const blob = await res.blob();
                                  const url = URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = s.file_name || 'script';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  URL.revokeObjectURL(url);
                                } catch (err) {
                                  toast.error('Failed to download file');
                                }
                              }}
                            >
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">Download</span>
                            </Button>
                            {canEdit && (
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDeleteScript(s)}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="sr-only">Delete</span>
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

        {/* Portal Modal */}
        {showPortalModal.type && showPortalModal.url && (
          <Dialog key={portalModalKey} open={true} onOpenChange={() => setShowPortalModal({ type: null, url: null })}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{showPortalModal.type === 'feedback' ? 'Feedback Link' : 'Attendance Link'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input readOnly value={showPortalModal.url} onFocus={(e)=>e.currentTarget.select()} />
                <div className="flex items-center gap-2">
                  <Button onClick={() => navigator.clipboard.writeText(showPortalModal.url || '')}>Copy Link</Button>
                </div>
                {/* Robust QR: quickchart primary, google charts fallback */}
                <img
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(showPortalModal.url || '')}&size=220&margin=2`}
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.onerror = null;
                    target.src = `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(showPortalModal.url || '')}`;
                  }}
                  alt="QR Code"
                  className="mx-auto border rounded"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

            {/* Analytics Section */}
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Event Analytics</h3>
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Analytics Dashboard
                  </h4>
                  
                  {/* Analytics Toggle Button */}
                  <div className="mb-4">
                    <Button
                      onClick={handleShowAnalytics}
                      className="bg-green-600 hover:bg-green-700 text-white w-full max-[400px]:w-full sm:w-auto"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      View Analytics
                    </Button>
                  </div>

                  {/* Quick Stats Preview */}
                  {eventItems && eventItems.length > 0 && (() => {
                    const analytics = generateAnalyticsData();
                    return (
                      <div className="grid grid-cols-1 max-[400px]:grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-green-500/20">
                          <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-1" />
                          <div className="text-white font-semibold">
                            PHP {analytics?.totalItemCost.toFixed(2) || '0.00'}
                          </div>
                          <div className="text-slate-400 text-xs">Total Item Cost</div>
                        </div>
                        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-blue-500/20">
                          <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                          <div className="text-white font-semibold">
                            PHP {analytics?.finalEventPrice.toFixed(2) || '0.00'}
                          </div>
                          <div className="text-slate-400 text-xs">Event Price</div>
                        </div>
                        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-purple-500/20">
                          <Users className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                          <div className="text-white font-semibold">{collaborators.length + 1}</div>
                          <div className="text-slate-400 text-xs">Members</div>
                        </div>
                        <div className="bg-slate-800/60 rounded-lg p-3 text-center border border-amber-500/20">
                          <Package className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                          <div className="text-white font-semibold">{eventItems.length}</div>
                          <div className="text-slate-400 text-xs">Items</div>
                        </div>
                      </div>
                    );
                  })()}

                  {eventItems && eventItems.length === 0 && (
                    <div className="text-center py-8">
                      <BarChart3 className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                      <div className="text-slate-400">Add event items to see analytics</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Green Rectangle Concept (hidden when chat open) */}
          <div className="lg:col-span-1">
            {!showChat && (
            <div className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto h-fit space-y-6 z-20 self-start">
              {/* Event Actions */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 flex flex-col">
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

                  {/* Event Notes & Set Status - Role-based visibility */}
                  {((isOwner && showMoreActions) || (userRole === "moderator" && showMoreActions)) && (
                    <>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                      onClick={() => handleEventAction("notes")}
                    >
                      <FileText className="w-4 h-4 mr-3" />
                      Event Notes
                    </Button>

                    {/* Set Status - Only for owners and moderators */}
                    {(isOwner || userRole === "moderator") && (
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
                    </>
                  )}

                  {/* Public links - Available to owners, moderators, and members */}
                  {((isOwner && showMoreActions) || (userRole === "moderator" && showMoreActions) || (userRole === "member" && showMoreActions)) && (
                        <div className="mt-3 space-y-3">
                          <Button
                            variant="outline"
                            className="w-full justify-start border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                            onClick={() => generatePublicPortal('feedback')}
                            disabled={isGeneratingPortal.type === 'feedback'}
                          >
                            <span className="flex items-center gap-2 text-sm whitespace-normal break-words leading-snug text-left">
                              {isGeneratingPortal.type === 'feedback' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Link2 className="w-4 h-4" />
                              )}
                              {isGeneratingPortal.type === 'feedback' ? 'Generating...' : 'Feedback Link'}
                            </span>
                          </Button>

                          <Button
                            variant="outline"
                            className="w-full justify-start border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                            onClick={() => generatePublicPortal('attendance')}
                            disabled={isGeneratingPortal.type === 'attendance'}
                          >
                            <span className="flex items-center gap-2 text-sm whitespace-normal break-words leading-snug text-left">
                              {isGeneratingPortal.type === 'attendance' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <QrCode className="w-4 h-4" />
                              )}
                              {isGeneratingPortal.type === 'attendance' ? 'Generating...' : 'Attendance Link'}
                            </span>
                          </Button>
                        </div>
                      )}

                  {/* Expand/Collapse button */}
                  {(isOwner || userRole === "moderator" || userRole === "member") && (
                      <div className="mt-auto pt-2">
                        <button
                          type="button"
                          aria-label="Toggle more actions"
                          className="w-full flex items-center justify-center py-1"
                          onClick={() => setShowMoreActions((s) => !s)}
                        >
                          {showMoreActions ? (
                            <ChevronUp className="w-6 h-6 text-green-400" />
                          ) : (
                            <ChevronDown className="w-6 h-6 text-green-400" />
                          )}
                        </button>
                      </div>
                  )}
                </div>
              </div>

              {/* Event Members/People */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-6 max-h-[400px] flex flex-col">
                <h3 className="text-xl font-semibold text-purple-400 mb-6 flex-shrink-0">
                  Event Members
                </h3>
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="space-y-4 flex-1 overflow-y-auto">
                  {(() => {
                    // Create a combined list with owner first, then collaborators sorted by joined_at
                    const allMembers = [];
                    
                    // Add event owner first
                    if (event?.user_id) {
                      allMembers.push({
                        id: 'owner',
                        user_id: event.user_id,
                        role: 'owner',
                        joined_at: event.created_at,
                        profiles: event.profiles || null
                      });
                    }
                    
                    // Add collaborators sorted by joined_at (oldest first for moderators)
                    const sortedCollaborators = [...collaborators].sort((a, b) => {
                      // Sort by role first (moderators before members), then by joined_at
                      if (a.role !== b.role) {
                        if (a.role === 'moderator') return -1;
                        if (b.role === 'moderator') return 1;
                      }
                      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
                    });
                    
                    allMembers.push(...sortedCollaborators);
                    
                    return allMembers.length > 0 ? (
                      allMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20"
                        >
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                            {member.profiles?.avatar_url ? (
                              <Image
                                src={member.profiles.avatar_url}
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
                              {member.profiles?.fname &&
                              member.profiles?.lname
                                ? `${member.profiles.fname} ${member.profiles.lname}`
                                : member.profiles?.username ||
                                  "Unknown User"}
                            </div>
                            <div className="text-purple-300 text-sm capitalize">
                              {member.role === "owner" ? "Event Organizer" : member.role}
                            </div>
                          </div>
                          {isOwner && member.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveCollaborator(
                                  member.id,
                                  member.profiles?.fname &&
                                    member.profiles?.lname
                                    ? `${member.profiles.fname} ${member.profiles.lname}`
                                    : member.profiles?.username ||
                                        "Unknown User"
                                )
                              }
                              disabled={
                                isRemovingCollaborator === member.id
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
                    );
                  })()}
                  </div>
                  
                  <div className="mt-4 flex-shrink-0">
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
            )}
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

                  <div className="space-y-2 text-center">
                    <Label className="text-white text-sm">QR Code</Label>
                    <Button
                      onClick={() => setShowQRCode(!showQRCode)}
                      className="bg-amber-600 hover:bg-amber-700 text-white w-full"
                      type="button"
                    >
                      {showQRCode ? "Hide QR" : "Show QR"}
                    </Button>
                    {showQRCode && (
                      <>
                        <div className="bg-white p-4 rounded-lg border border-amber-500/30 inline-flex items-center justify-center">
                          {typeof window !== "undefined" && inviteCode && (
                            <QRCode
                              value={`${window.location.origin}/events?code=${inviteCode}`}
                              size={200}
                              level="M"
                              fgColor="#000000"
                              bgColor="#ffffff"
                            />
                          )}
                        </div>
                        <p className="text-slate-400 text-xs">
                          Scan this QR code to join the event
                        </p>
                      </>
                    )}
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
                    onClick={canEdit ? handleToggleAiChat : undefined}
                    disabled={!canEdit}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                      aiChatEnabled ? "bg-emerald-500" : "bg-slate-600"
                    } ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        aiChatEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Data Analytics removed per request */}

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
                              {collaborator.role === "owner" ? "Event Organizer" : collaborator.role}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium px-2 py-1 rounded-full bg-slate-600 text-white">
                            {collaborator.role === "owner" ? "Event Organizer" : collaborator.role}
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

              {/* Leave Event - Only for moderators and members */}
              {!isOwner && (userRole === "moderator" || userRole === "member") && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-orange-400 mb-2">
                    Leave Event
                  </h4>
                  <p className="text-slate-300 text-sm mb-4">
                    Leave this event and remove yourself from all event activities.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleLeaveEvent}
                    disabled={isLeavingEvent}
                    className="border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300"
                  >
                    {isLeavingEvent ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Leaving...
                      </>
                    ) : (
                      <>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Leave Event
                      </>
                    )}
                  </Button>
                </div>
              )}

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

              <div>
                <Label className="text-white">Cost *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newItem.cost}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      cost: parseFloat(e.target.value) || 0.00,
                    })
                  }
                  placeholder="0.00"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-red-500/30 rounded-lg p-4 sm:p-6 w-full max-w-md mx-auto">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Trash2 className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2">
                {deleteType === "event" ? "Delete Event" : "Delete Item"}
              </h3>
              <p className="text-sm sm:text-base text-slate-300">
                {deleteType === "event"
                  ? "Are you sure you want to delete this event? This action cannot be undone."
                  : `Are you sure you want to delete "${itemToDelete?.item_name && itemToDelete.item_name.length > 30 
                    ? itemToDelete.item_name.substring(0, 30) + "..." 
                    : itemToDelete?.item_name}"?`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
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

      {/* Full-height Right Chat Sidebar */}
      {showChat && (
        <div className="fixed right-0 top-0 h-screen w-full sm:w-[420px] bg-slate-900 border-l border-slate-700 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/70 backdrop-blur">
            <div className="flex items-center gap-2 text-white">
              <MessageCircle className="w-4 h-4" />
              <span className="font-semibold">Event Chat</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(false)}
              className="text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-slate-400 text-sm">No messages yet.</div>
            ) : (
              chatMessages.map((m) => {
                // Check if current user owns this message
                const isCurrentUserMessage = m.user_id === currentUserId;
                
                return (
                  <div key={m.id} className="bg-slate-800/60 border border-slate-700 rounded-md p-3 text-slate-200 group relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-slate-300 font-medium truncate max-w-[60%]">
                      {(userMap[m.user_id]?.fname && userMap[m.user_id]?.lname)
                        ? `${userMap[m.user_id].fname} ${userMap[m.user_id].lname}`
                        : userMap[m.user_id]?.username || "Unknown"}
                    </div>
                      <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-400">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                    </div>
                        {/* Show delete button for message owner, event owner, or moderators */}
                        {m.message !== "Message deleted" && (isCurrentUserMessage || canEdit) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMessage(m.id)}
                            disabled={deletingMessageId === m.id}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {deletingMessageId === m.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                  </div>
                </div>
                    <div className="whitespace-pre-wrap break-words">
                      {m.message === "Message deleted" ? (
                        <span className="text-slate-500 italic">{m.message}</span>
                      ) : (
                        m.message
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-3 border-t border-slate-700 bg-slate-800/60">
            <div className="flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-700 border-slate-600 text-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button onClick={handleSendMessage} disabled={isSending || !newMessage.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showMessageDeleteConfirm} onOpenChange={setShowMessageDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Confirm Message Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={cancelDeleteMessage}
              disabled={deletingMessageId === messageToDelete}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteMessage}
              disabled={deletingMessageId === messageToDelete}
            >
              {deletingMessageId === messageToDelete ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Success Dialog */}
      <Dialog open={showMessageDeleteSuccess} onOpenChange={setShowMessageDeleteSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Message Deleted
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              The message has been successfully deleted.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Script Delete Confirmation Dialog */}
      <Dialog open={showScriptDeleteConfirm} onOpenChange={setShowScriptDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Confirm Script Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete this script? This action cannot be undone.
            </p>
            {scriptToDelete && (
              <div className="mt-3 p-3 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-300">
                  <strong>File:</strong> {scriptToDelete.file_name && scriptToDelete.file_name.length > 9 
                    ? scriptToDelete.file_name.substring(0, 9) + "..." 
                    : scriptToDelete.file_name || 'Unknown file'}
                </p>
                <p className="text-sm text-slate-400">
                  <strong>Size:</strong> {scriptToDelete.file_size ? `${(scriptToDelete.file_size / 1024).toFixed(1)} KB` : 'Unknown'}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={cancelDeleteScript}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteScript}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Script
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Notes Modal */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="sm:max-w-2xl max-h-[75vh] bg-slate-900 border-amber-500/30 flex flex-col">
          <DialogHeader className="border-b border-amber-500/20 pb-4 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <FileText className="h-5 w-5" />
              Event Notes
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 flex-1 flex flex-col min-h-0">
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex-1 flex flex-col">
                <Label className="text-sm font-medium text-amber-300 mb-2 block">
                  Private Notes (Only visible to you)
                </Label>
                <textarea
                  value={eventNotes}
                  onChange={(e) => {
                    if (e.target.value.length <= 2500) {
                      setEventNotes(e.target.value);
                    }
                  }}
                  placeholder="Write your private notes about this event..."
                  className="w-full flex-1 p-4 bg-slate-800 border border-amber-500/30 rounded-lg text-white resize-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-400 min-h-[200px]"
                  maxLength={2500}
                />
              </div>
              <div className="flex justify-between items-center text-xs flex-shrink-0">
                <span className={`font-medium ${eventNotes.length > 2000 ? 'text-red-400' : eventNotes.length > 1500 ? 'text-yellow-400' : 'text-amber-300'}`}>
                  Characters: {eventNotes.length}/2500
                </span>
                <span className="text-slate-400">These notes are private and only visible to event creators</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end border-t border-amber-500/20 pt-4 flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleDiscardNotes}
              disabled={isSavingNotes}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Discard Changes
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSavingNotes ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Notes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Modal */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] bg-slate-900 border-green-500/30 flex flex-col">
          <DialogHeader className="border-b border-green-500/20 pb-4 flex-shrink-0">
            <DialogTitle className="text-2xl font-bold text-green-400 flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              Event Analytics Dashboard
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-1">
            {analyticsData ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800/60 rounded-lg p-4 text-center border border-green-500/20">
                    <DollarSign className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">
                      PHP {analyticsData.totalItemCost.toFixed(2)}
                    </div>
                    <div className="text-slate-400 text-sm">Total Item Cost</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-4 text-center border border-blue-500/20">
                    <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">
                      PHP {analyticsData.finalEventPrice.toFixed(2)}
                    </div>
                    <div className="text-slate-400 text-sm">Event Price</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-4 text-center border border-purple-500/20">
                    <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{analyticsData.memberCount}</div>
                    <div className="text-slate-400 text-sm">Members</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-4 text-center border border-amber-500/20">
                    <Package className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{analyticsData.itemCount}</div>
                    <div className="text-slate-400 text-sm">Items</div>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
                  <h3 className="text-lg font-semibold text-white mb-4">Pricing Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Item Cost:</span>
                      <span className="text-white font-semibold">PHP {analyticsData.totalItemCost.toFixed(2)}</span>
                    </div>
                    {analyticsData.markupAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          Markup ({event.markup_type === 'percentage' ? `${event.markup_value}%` : `PHP ${event.markup_value}`}):
                        </span>
                        <span className="text-green-400 font-semibold">+PHP {analyticsData.markupAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {analyticsData.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          Discount ({event.discount_type === 'percentage' ? `${event.discount_value}%` : `PHP ${event.discount_value}`}):
                        </span>
                        <span className="text-red-400 font-semibold">-PHP {analyticsData.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-600 pt-2 font-semibold text-lg">
                      <span>Final Event Price:</span>
                      <span className="text-blue-400">PHP {analyticsData.finalEventPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gross Profit:</span>
                      <span className={`font-semibold ${analyticsData.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        PHP {analyticsData.grossProfit.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Profit Margin:</span>
                      <span className={`font-semibold ${analyticsData.profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {analyticsData.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Statistical Analysis */}
                  <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
                    <h3 className="text-lg font-semibold text-white mb-4">Statistical Analysis</h3>
                    <div className="space-y-4">
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <h4 className="text-blue-400 font-medium mb-2">Cost Statistics</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Mean:</span>
                            <span className="text-white font-semibold">PHP {analyticsData.statistics.cost.mean.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Median:</span>
                            <span className="text-white font-semibold">PHP {analyticsData.statistics.cost.median.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Mode:</span>
                            <span className="text-white font-semibold">PHP {analyticsData.statistics.cost.mode.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Range:</span>
                            <span className="text-white font-semibold">PHP {analyticsData.statistics.cost.range.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Std Dev:</span>
                            <span className="text-white font-semibold">PHP {analyticsData.statistics.cost.standardDeviation.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Min/Max:</span>
                            <span className="text-white font-semibold">PHP {analyticsData.statistics.cost.min.toFixed(2)} - PHP {analyticsData.statistics.cost.max.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="mt-2 p-2 bg-blue-500/10 rounded border-l-2 border-blue-500">
                          <p className="text-blue-300 text-xs">{analyticsData.statistics.cost.description}</p>
                        </div>
                      </div>
                      
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <h4 className="text-green-400 font-medium mb-2">Quantity Statistics</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Mean:</span>
                            <span className="text-white font-semibold">{analyticsData.statistics.quantity.mean.toFixed(1)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Median:</span>
                            <span className="text-white font-semibold">{analyticsData.statistics.quantity.median.toFixed(1)} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Range:</span>
                            <span className="text-white font-semibold">{analyticsData.statistics.quantity.range} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Min/Max:</span>
                            <span className="text-white font-semibold">{analyticsData.statistics.quantity.min} - {analyticsData.statistics.quantity.max} units</span>
                          </div>
                        </div>
                        <div className="mt-2 p-2 bg-green-500/10 rounded border-l-2 border-green-500">
                          <p className="text-green-300 text-xs">{analyticsData.statistics.quantity.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quantity vs Cost Chart */}
                  <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
                    <h3 className="text-lg font-semibold text-white mb-4">Items Overview</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analyticsData.quantityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                        <Tooltip 
                          formatter={(value, name) => [
                            name === 'quantity' ? `${value} units` : `PHP ${Number(value).toFixed(2)}`,
                            name === 'quantity' ? 'Quantity' : 'Cost'
                          ]}
                          labelStyle={{ color: '#F3F4F6' }}
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        />
                        <Bar dataKey="quantity" fill="#3B82F6" name="Quantity" />
                        <Bar dataKey="cost" fill="#10B981" name="Cost" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cost Trend Chart */}
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
                  <h3 className="text-lg font-semibold text-white mb-4">Cost Accumulation Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.costTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="item" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value) => [`PHP ${Number(value).toFixed(2)}`, 'Cumulative Cost']}
                        labelStyle={{ color: '#F3F4F6' }}
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      />
                      <Line type="monotone" dataKey="cumulative" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Additional Analytics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
                    <h3 className="text-lg font-semibold text-white mb-4">Cost Analysis</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Average Cost per Item:</span>
                        <span className="text-white font-semibold">PHP {analyticsData.averageCostPerItem.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Average Cost per Member:</span>
                        <span className="text-white font-semibold">PHP {analyticsData.averageCostPerMember.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cost Efficiency Score:</span>
                        <span className="text-white font-semibold">
                          {analyticsData.statistics.cost.standardDeviation < analyticsData.statistics.cost.mean * 0.2 ? 'High' : 
                           analyticsData.statistics.cost.standardDeviation < analyticsData.statistics.cost.mean * 0.5 ? 'Medium' : 'Low'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cost Variability:</span>
                        <span className="text-white font-semibold">
                          {analyticsData.statistics.cost.range > 0 ? 
                            `${((analyticsData.statistics.cost.range / analyticsData.statistics.cost.mean) * 100).toFixed(1)}%` : 
                            '0%'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-slate-900/50 rounded text-xs text-slate-300">
                      <p><strong>Interpretation:</strong> {analyticsData.statistics.cost.description}</p>
                    </div>
                  </div>

                  <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Attendance & Engagement</h3>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`/attendance-list?event=${event.id}`, '_blank')}
                        className="text-xs"
                      >
                        View All Attendance
                      </Button>
                    </div>
                    {attendeesStats && (
                      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between"><span className="text-slate-400">Expected:</span><span className="text-white font-semibold">{attendeesStats.expected_attendees}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Actual:</span><span className="text-white font-semibold">{attendeesStats.event_attendees}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Records:</span><span className="text-white font-semibold">{analyticsData.attendanceRecordsCount}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Attendance Rate:</span><span className="text-white font-semibold">{analyticsData.attendanceRate.toFixed(1)}%</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Records Rate:</span><span className="text-white font-semibold">{analyticsData.attendanceRecordsRate.toFixed(1)}%</span></div>
                      </div>
                    )}
                    
                    {/* Feedback Section */}
                    <div className="mt-4 pt-4 border-t border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-white">Feedback Analysis</h4>
                        {analyticsData.feedbackMetrics.total > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`/feedback-list?event=${event.id}`, '_blank')}
                            className="text-xs"
                          >
                            View All Feedback
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between"><span className="text-slate-400">Total Responses:</span><span className="text-white font-semibold">{analyticsData.feedbackMetrics.total}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Avg Rating:</span><span className="text-white font-semibold">{analyticsData.feedbackMetrics.averageRating.toFixed(1)}/5</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Positive:</span><span className="text-green-400 font-semibold">{analyticsData.feedbackMetrics.positive}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Neutral:</span><span className="text-yellow-400 font-semibold">{analyticsData.feedbackMetrics.neutral}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Negative:</span><span className="text-red-400 font-semibold">{analyticsData.feedbackMetrics.negative}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Response Rate:</span><span className="text-white font-semibold">{analyticsData.feedbackResponseRate.toFixed(1)}%</span></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Item Cost:</span>
                        <span className="text-white font-semibold">PHP {analyticsData.totalItemCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Markup Amount:</span>
                        <span className="text-white font-semibold">PHP {analyticsData.markupAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Final Event Price:</span>
                        <span className="text-white font-semibold">PHP {analyticsData.finalEventPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Available Buffer:</span>
                        <span className="text-white font-semibold">PHP {(analyticsData.finalEventPrice - analyticsData.totalItemCost).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Buffer Percentage:</span>
                        <span className="text-white font-semibold">
                          {analyticsData.totalItemCost > 0 ? 
                            `${(((analyticsData.finalEventPrice - analyticsData.totalItemCost) / analyticsData.totalItemCost) * 100).toFixed(1)}%` : 
                            '0%'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Resources per Member:</span>
                        <span className="text-white font-semibold">
                          {analyticsData.memberCount > 0 ? (analyticsData.totalQuantity / analyticsData.memberCount).toFixed(1) : 0} units
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Budget per Member:</span>
                        <span className="text-white font-semibold">
                          {analyticsData.memberCount > 0 ? (analyticsData.finalEventPrice / analyticsData.memberCount).toFixed(2) : 0} PHP
                        </span>
                    </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          value={expectedInput}
                          onChange={(e)=>setExpectedInput(e.target.value)}
                          placeholder="Update expected attendees"
                        />
                        <Button onClick={saveExpectedAttendees} disabled={isSavingExpected}>Save</Button>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-slate-900/50 rounded text-xs text-slate-300">
                      <p><strong>Budget Allocation:</strong> You have PHP {(analyticsData.finalEventPrice - analyticsData.totalItemCost).toFixed(2)} available for contingencies, additional resources, or profit. This represents {analyticsData.totalItemCost > 0 ? `${(((analyticsData.finalEventPrice - analyticsData.totalItemCost) / analyticsData.totalItemCost) * 100).toFixed(1)}%` : '0%'} of your base costs.</p>
                    </div>
                  </div>
                </div>

                {/* AI Insights - Moved to Bottom */}
                <div className="bg-slate-800/60 rounded-lg p-4 border border-purple-500/20">
                  <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    AI-Powered Insights
                  </h3>
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    {isGeneratingInsights ? (
                      <div className="flex items-center gap-2 text-purple-300">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        Generating insights...
                      </div>
                    ) : aiInsights ? (
                      <div>
                        <div className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed mb-3">
                          {aiInsights}
                        </div>
                        {event?.insights_generated_at && (
                          <div className="text-xs text-slate-500 border-t border-slate-700 pt-2">
                            Generated on {new Date(event.insights_generated_at).toLocaleDateString()} at {new Date(event.insights_generated_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-400 font-medium">Insights Required</span>
                        </div>
                        <p>You must generate AI insights before you can save or view detailed analytics. Click "Generate Insights" below to get AI-powered recommendations based on your event's statistical data.</p>
                      </div>
                    )}
                  </div>
                  {/* Usage Info */}
                  <div className="mb-4 p-3 bg-slate-700/50 border border-slate-600 rounded-lg">
                    <p className="text-xs text-slate-300">
                      {insightsUsageInfo ? (
                        <>
                          Insights generated this week: {insightsUsageInfo.insightsGenerated}/{insightsUsageInfo.maxInsights}
                          {!insightsUsageInfo.canGenerateMore && (
                            <span className="text-red-400 ml-2">(Limit reached)</span>
                          )}
                        </>
                      ) : (
                        "Loading usage information..."
                      )}
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={generateAIInsights}
                      disabled={Boolean(isGeneratingInsights || !(insightsUsageInfo?.canGenerateMore ?? true))}
                      className={`text-white ${
                        !insightsUsageInfo || insightsUsageInfo.canGenerateMore
                          ? "bg-purple-600 hover:bg-purple-700" 
                          : "bg-slate-600 cursor-not-allowed opacity-50"
                      }`}
                    >
                      {isGeneratingInsights ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4 mr-2" />
                          Generate Insights
                        </>
                      )}
                    </Button>
                    {aiInsights && (
                      <Button
                        onClick={() => {
                          // Save insights functionality can be added here
                          toast.success("Insights saved successfully!");
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Insights
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <div className="text-slate-400">No analytics data available</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Event Confirmation Dialog */}
      {showLeaveConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-orange-500/30 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-orange-400">
                Leave Event
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLeaveConfirmDialog(false)}
                className="text-slate-400 hover:text-white"
                disabled={isLeavingEvent}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-orange-300">
                <AlertCircle className="w-5 h-5 text-orange-400" />
                <span className="font-medium">Are you sure you want to leave this event?</span>
              </div>
              
              <p className="text-slate-300 text-sm">
                This action will remove you from all event activities and you will no longer have access to:
              </p>
              
              <ul className="text-slate-400 text-sm space-y-1 ml-4">
                <li>• Event chat and discussions</li>
                <li>• Event analytics and insights</li>
                <li>• Collaboration features</li>
                <li>• Event updates and notifications</li>
              </ul>
              
              <p className="text-slate-300 text-sm font-medium">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowLeaveConfirmDialog(false)}
                disabled={isLeavingEvent}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={confirmLeaveEvent}
                disabled={isLeavingEvent}
                className="flex-1 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300"
              >
                {isLeavingEvent ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Leaving...
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Leave Event
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Collaborator Confirmation Dialog */}
      {showRemoveConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-red-500/30 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">
                Remove Collaborator
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelRemoveCollaborator}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-slate-300 mb-6">
              Are you sure you want to remove <span className="font-semibold text-white">{collaboratorToRemove?.name}</span> from this event? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={cancelRemoveCollaborator}
                disabled={isRemovingCollaborator === collaboratorToRemove?.id}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmRemoveCollaborator}
                disabled={isRemovingCollaborator === collaboratorToRemove?.id}
              >
                {isRemovingCollaborator === collaboratorToRemove?.id ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Component */}
      <AIChat 
        eventId={eventId}
        eventTitle={event.title}
        eventDescription={event.description}
        isEnabled={aiChatEnabled}
      />
    </div>
  );
}
