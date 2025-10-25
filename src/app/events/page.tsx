"use client"; // Make it a Client Component

import { useState, useMemo, useEffect, useRef, Suspense } from "react"; // Import hooks
import { Metadata } from "next"; // Keep Metadata type import if needed elsewhere, but can't export from client component
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  ListFilter,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { EventCountManager } from "@/lib/event-count-manager";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Database } from "@/types/supabase";
import { EventLimitsCard } from "@/components/ui/event-limits-card";
import { useEventsPageFailsafe } from "@/hooks/useEventsPageFailsafe";
import { EventsPageFailsafePopup } from "@/components/ui/events-page-failsafe-popup";
import { LimitExceededWarningCard } from "@/components/ui/limit-exceeded-warning-card";
import { LoadingPopup } from "@/components/ui/loading-popup";
import { useAuth } from "@/context/auth-context";

type Event = Database["public"]["Tables"]["events"]["Row"];

// Note: Cannot export metadata from a Client Component.
// Move metadata to layout.tsx or a dedicated server component if needed.
// export const metadata: Metadata = {
//   title: "Browse Events - EventTria",
//   description: "Find and join upcoming events on EventTria",
// };

function EventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Add failsafe check
  const { 
    showFailsafe, 
    isChecking, 
    handleFailsafeSuccess, 
    handleFailsafeClose 
  } = useEventsPageFailsafe();

  // Get user for failsafe popup
  const { user } = useAuth();

  // Pagination state
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 7;

  // Join event state
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [eventToJoin, setEventToJoin] = useState<any>(null);

  const hasAutoTriedJoinRef = useRef(false);

  // Check authentication first
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

  useEffect(() => {
    // Only fetch events if authenticated
    if (!isAuthenticated) return;

    fetchEvents();

    // Read invite code from URL using Next.js search params
    const codeParam = searchParams?.get("code") || "";
    const normalized = codeParam.trim().toUpperCase();
    if (normalized && normalized.length <= 12) {
      setInviteCode(normalized);
      setShowJoinForm(true);
      if (!hasAutoTriedJoinRef.current) {
        hasAutoTriedJoinRef.current = true;
        setTimeout(() => {
          handleJoinEvent();
        }, 50);
      }
    }

    const statusInterval = setInterval(() => {
      updateEventStatuses();
    }, 60000);

    return () => clearInterval(statusInterval);
  }, [searchParams, isAuthenticated]);

  // Function to update event statuses automatically
  const updateEventStatuses = async () => {
    try {
      // Only update events owned by current user to avoid RLS 400s
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;

      const now = new Date();

      // Update events that should change status
      const { data: eventsToUpdate } = await supabase
        .from("events")
        .select("id, date, status")
        .eq("user_id", uid)
        .in("status", ["coming_soon", "ongoing"])
        .not("status", "in", "('cancelled', 'archived')");

      if (eventsToUpdate) {
        for (const event of eventsToUpdate) {
          const eventDate = new Date(event.date);
          const eventEndDate = new Date(
            eventDate.getTime() + 2 * 60 * 60 * 1000
          ); // 2 hours after start

          let newStatus = event.status;

          if (event.status === "coming_soon" && now >= eventDate) {
            newStatus = "ongoing";
          } else if (event.status === "ongoing" && now >= eventEndDate) {
            newStatus = "done";
          }

          if (newStatus !== event.status) {
            await supabase
              .from("events")
              .update({ status: newStatus })
              .eq("id", event.id);
          }
        }

        // Refresh events list if any statuses were updated
        fetchEvents();
      }
    } catch (error) {
      console.error("Error updating event statuses:", error);
    }
  };

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setEvents([]);
        setCategories([]);
        return;
      }

      // Fetch user-created events and joined events
      // Try multiple approaches to get collaborations
      
      // Approach 1: Direct query
      const { data: collabRows, error: collabError } = await supabase
        .from("event_collaborators")
        .select("event_id, role")
        .eq("user_id", user.id);
      
      // Approach 2: Try using RPC if direct query fails
      let fallbackCollabRows = [];
      if (collabError || !collabRows || collabRows.length === 0) {
        console.log("Direct query failed or returned empty, trying RPC...");
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_user_collaborations', { p_user_id: user.id });
        if (!rpcError && rpcData) {
          fallbackCollabRows = rpcData;
          console.log("RPC returned:", fallbackCollabRows);
        }
      }
      
      // Use whichever approach worked
      const finalCollabRows = collabRows || fallbackCollabRows;
      
      // Fetch own events
      const { data: ownEvents, error: ownError } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .not("status", "in", "('cancelled', 'archived')");

      if (ownError) {
        console.error("Error fetching own events:", ownError);
        throw ownError;
      }

      console.log("User ID:", user.id);
      console.log("Collaboration rows (direct):", collabRows);
      console.log("Collaboration rows (final):", finalCollabRows);
      console.log("Own events:", ownEvents);

      const joinedEventIds = (finalCollabRows || []).map((r: any) => r.event_id);
      console.log("Joined event IDs:", joinedEventIds);

      let joinedEvents: Event[] = [];
      if (joinedEventIds.length > 0) {
        const { data: joinedData, error: joinedError } = await supabase
          .from("events")
          .select("*")
          .in("id", joinedEventIds)
          .not("status", "in", "('cancelled', 'archived')");
        if (joinedError) {
          console.error("Error fetching joined events:", joinedError);
          throw joinedError;
        }
        joinedEvents = joinedData || [];
        console.log("Joined events data:", joinedEvents);
      }

      // Merge results, de-duplicate, and sort by date ascending
      const mapById = new Map<string, Event>();
      [...(ownEvents || []), ...joinedEvents].forEach((evt) => {
        if (!mapById.has(evt.id)) mapById.set(evt.id, evt);
      });
      const merged = Array.from(mapById.values()).sort(
        (a, b) => new Date(a.date as any).getTime() - new Date(b.date as any).getTime()
      );

      console.log("Final merged events:", merged);
      setEvents(merged);
      setError(null);

      // Extract unique categories from events
      const uniqueCategories = [
        ...new Set(merged.map((event) => event.category).filter(Boolean) as string[]),
      ];
      setCategories(uniqueCategories);
    } catch (err: any) {
      console.error("Error fetching events:", err);
      // Don't set error state, just show empty events list
      setEvents([]);
      setError(null);
      // Fallback categories
      setCategories([
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
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized filtering logic
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        searchTerm === "" ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(event.category);

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategories, events]); // Recalculate when search, filters, or events change

  // Reset to first page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategories]);

  // Compute current page slice
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  }, [filteredEvents.length]);

  // Clamp page if data shrinks
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const currentPageEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredEvents.slice(start, end);
  }, [filteredEvents, page]);

  // Handler for category filter changes
  const handleCategoryChange = (category: string, checked: boolean) => {
    setSelectedCategories(
      (prev) =>
        checked
          ? [...prev, category] // Add category if checked
          : prev.filter((c) => c !== category) // Remove category if unchecked
    );
  };

  const handleJoinEvent = async () => {
    console.log("🔵 handleJoinEvent called with inviteCode:", inviteCode);
    
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    try {
      console.log("🔵 Starting join event process...");
      
      // Get current session/user (more reliable in client)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      console.log("🔵 User auth result:", { user: user?.id, sessionError });
      
      if (sessionError || !user) {
        throw new Error("You must be logged in to join an event");
      }
      console.log("🔵 User authenticated:", user.id);

      // Find the invite (normalize code + allow non-expired or null expiry)
      const normalizedCode = inviteCode.trim();
      console.log("🔵 Looking for invite code:", normalizedCode);
      const { data: inviteData, error: inviteError } = await supabase
        .from("event_invites")
        .select("id,event_id,role,invite_code,created_by,expires_at,current_uses,max_uses,is_active")
        .eq("invite_code", normalizedCode)
        .limit(1)
        .maybeSingle();

      console.log("🔵 Invite query result:", { inviteData, inviteError });

      // Validate invite before any further queries
      if (inviteError || !inviteData) {
        console.error("🔴 Invite not found or error:", inviteError);
        throw new Error("Invalid or expired invite code");
      }

      // Optionally fetch event for dialog display (only after invite validated)
      let inviteWithEvent: any = inviteData;
      try {
        const { data: eventMeta } = await supabase
          .from('events')
          .select('id,title,description,date,location')
          .eq('id', inviteData.event_id)
          .single();
        if (eventMeta) inviteWithEvent = { ...inviteData, events: eventMeta };
      } catch {}

      // Extra guard: local expiry check
      if (inviteData.expires_at && new Date(inviteData.expires_at) <= new Date()) {
        throw new Error("This invite code has expired");
      }

      // Check if user has already used this invite
      if ((inviteData.current_uses ?? 0) >= (inviteData.max_uses ?? 1)) {
        throw new Error("This invite code has reached its maximum usage limit");
      }

      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from("event_collaborators")
        .select("*")
        .eq("event_id", inviteData.event_id)
        .eq("user_id", user.id)
        .maybeSingle();

      console.log("🔵 Existing member check:", { existingMember, memberCheckError });

      if (existingMember) {
        throw new Error("You are already a member of this event");
      }

      console.log("🔵 All checks passed, showing confirmation dialog");
      // Show confirmation dialog
      setEventToJoin(inviteWithEvent);
      setShowConfirmDialog(true);
      
    } catch (error: any) {
      console.error("🔴 Error validating invite:", error);
      console.error("🔴 Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast.error(error.message || "Failed to validate invite code");
    }
  };

  const confirmJoinEvent = async () => {
    console.log("🟢 confirmJoinEvent called with eventToJoin:", eventToJoin);
    
    if (!eventToJoin) {
      console.log("🔴 No event to join");
      return;
    }

    setIsJoining(true);
    try {
      // 1) Auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (sessionError || !user) throw new Error('You must be logged in to join an event');

      // 2) Resolve invite (use eventToJoin if present, else fetch by code)
      const code = inviteCode.trim();
      let invite = eventToJoin;
      if (!invite) {
        const { data: inviteData, error: inviteError } = await supabase
          .from('event_invites')
          .select(`id,event_id,role,invite_code,created_by,expires_at,current_uses,max_uses,is_active, events:event_id(*)`)
          .eq('invite_code', code)
          .limit(1)
          .maybeSingle();
        if (inviteError || !inviteData) throw new Error('Invalid or expired invite code');
        invite = inviteData;
      }

      // 3) Business checks
      if ((invite.current_uses ?? 0) >= (invite.max_uses ?? 1)) throw new Error('This invite code has reached its maximum usage limit');
      const { data: existing, error: existErr } = await supabase
        .from('event_collaborators')
        .select('id')
        .eq('event_id', invite.event_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existErr) throw existErr;
      if (existing) throw new Error('You are already a member of this event');

      // 4) Insert collaborator via RPC to bypass complex RLS paths
      const { data: rpcRes, error: joinError } = await supabase
        .rpc('join_event_with_code', { p_user: user.id, p_code: invite.invite_code });
      if (joinError) throw joinError;

      // 5) Create notifications for successful event joining
      try {
        // Get event details for notification
        const { data: eventData } = await supabase
          .from('events')
          .select('title, user_id')
          .eq('id', invite.event_id)
          .single();

        if (eventData) {
          // Notification for the user who joined
          await supabase.from("notifications").insert({
            user_id: user.id,
            type: "event_joined",
            title: "Successfully Joined Event",
            message: `You have successfully joined "${eventData.title}" as a ${rpcRes?.[0]?.role || 'member'}.`,
            event_id: invite.event_id,
            link_url: `/event/${invite.event_id}`,
            metadata: { role: rpcRes?.[0]?.role || 'member', event_title: eventData.title }
          });

          // Notification for the event owner (if different from joiner)
          if (eventData.user_id !== user.id) {
            const { data: joinerProfile } = await supabase
              .from('profiles')
              .select('fname, lname, username')
              .eq('id', user.id)
              .single();

            const joinerName = joinerProfile?.fname && joinerProfile?.lname 
              ? `${joinerProfile.fname} ${joinerProfile.lname}`
              : joinerProfile?.username || 'Someone';

            await supabase.from("notifications").insert({
              user_id: eventData.user_id,
              type: "event_joined",
              title: "New Event Member",
              message: `${joinerName} has joined your event "${eventData.title}" as a ${rpcRes?.[0]?.role || 'member'}.`,
              event_id: invite.event_id,
              link_url: `/event/${invite.event_id}`,
              metadata: { 
                joiner_id: user.id,
                joiner_name: joinerName,
                role: rpcRes?.[0]?.role || 'member',
                event_title: eventData.title
              }
            });
          }
        }
      } catch (notifError) {
        console.warn("Failed to create event join notifications:", notifError);
        // Don't fail the whole join process if notification fails
      }

      // 6) Update usage (best-effort)
      const nextUses = (invite.current_uses ?? 0) + 1;
      const { error: usageErr } = await supabase
        .from('event_invites')
        .update({ current_uses: nextUses, is_active: nextUses < invite.max_uses })
        .eq('id', invite.id);
      if (usageErr) console.warn('Failed to update invite usage', usageErr);

      toast.success('Joined the event!');

      // Update event counts
      try {
        await EventCountManager.onEventJoined(user.id, invite.event_id);
        // Dispatch event to refresh counters
        window.dispatchEvent(new CustomEvent('eventJoined'));
      } catch (countError) {
        console.warn("Failed to update event counts:", countError);
        // Don't fail the whole process if count update fails
      }

      // Reset and go
      setInviteCode('');
      setShowJoinForm(false);
      setShowConfirmDialog(false);
      setEventToJoin(null);

      if (invite.events?.id) {
        router.push(`/event/${invite.events.id}`);
      } else {
        fetchEvents();
      }
    } catch (error: any) {
      console.error("🔴 Error joining event:", error);
      console.error("🔴 Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast.error(error.message || "Failed to join event");
    } finally {
      setIsJoining(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Date TBD";
    }
  };

  const getDefaultImage = (type: string) => {
    const typeImages: { [key: string]: string } = {
      Technology: "/images/tech-conf.webp",
      Music: "/images/music-fest.webp",
      "Food & Drink": "/images/food-expo.webp",
      // Use existing images for other types
      "Arts & Culture": "/images/event.webp",
      Business: "/images/tech-conf.webp",
      Gaming: "/images/event.webp",
      Health: "/images/event.webp",
      Film: "/images/event.webp",
    };
    return typeImages[type] || "/images/event.webp";
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    const statusConfig: {
      [key: string]: { label: string; className: string };
    } = {
      coming_soon: {
        label: "Coming Soon",
        className: "bg-green-500/20 text-green-400 border-green-500/30",
      },
      ongoing: {
        label: "Ongoing",
        className: "bg-green-500/20 text-green-400 border-green-500/30",
      },
      done: {
        label: "Done",
        className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      },
      cancelled: {
        label: "Cancelled",
        className: "bg-red-500/20 text-red-400 border-red-500/30",
      },
      archived: {
        label: "Archived",
        className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      },
    };

    return (
      statusConfig[status] || {
        label: "Unknown",
        className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      }
    );
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Checking authentication...</span>
      </div>
    );
  }

  // Show loading while fetching events
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading events...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div>
        <h1 className="text-2xl max-[639px]:text-xl sm:text-4xl font-bold mb-3 mt-4">Browse Events</h1>
        <div className="flex flex-col max-[374px]:flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end items-stretch sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search events..."
              className="pl-8 w-full sm:w-[200px] md:w-[250px] lg:w-[300px] bg-background text-xs max-[639px]:text-xs sm:text-base"
              value={searchTerm} // Bind value to state
              onChange={(e) => setSearchTerm(e.target.value)} // Update state on change
            />
          </div>
          <div className="flex flex-row max-[374px]:flex-col gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 max-[639px]:h-7 sm:h-9 gap-1 flex-1 max-[374px]:w-full sm:w-auto text-xs max-[639px]:text-xs sm:text-base">
                <ListFilter className="h-3.5 w-3.5" />
                  <span className="max-[374px]:inline sm:inline">
                    Filter ({selectedCategories.length})
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.includes(category)} // Bind checked state
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category, !!checked)
                  } // Handle change
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

            <Button asChild size="sm" className="h-8 max-[639px]:h-7 sm:h-9 gap-1 flex-1 max-[374px]:w-full sm:w-auto text-xs max-[639px]:text-xs sm:text-base">
            <Link href="/create-event">
              <Plus className="h-3.5 w-3.5" />
                <span className="max-[374px]:inline sm:inline">
                Create Event
              </span>
            </Link>
          </Button>
        </div>
        </div>
      </div>

        {/* Limit Exceeded Warning Card */}
        <div className="w-full">
          <LimitExceededWarningCard />
        </div>

        {/* Event Limits Card */}
        <div className="w-full">
          <EventLimitsCard />
        </div>

      {/* Events Grid - Render filteredEvents */}
      <div className="grid gap-3 max-[639px]:gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Join Event Card */}
        {!showJoinForm ? (
          <div
            className="group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer min-h-[150px] max-[639px]:min-h-[140px] sm:min-h-[200px] flex flex-col items-center justify-center p-3 max-[639px]:p-3 sm:p-6 border-dashed border-emerald-500/40 hover:border-emerald-500/60 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
            onClick={() => setShowJoinForm(true)}
          >
            <div className="text-center">
              <div className="w-10 h-10 max-[639px]:w-10 max-[639px]:h-10 sm:w-16 sm:h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2 max-[639px]:mb-2 sm:mb-4 mx-auto group-hover:bg-emerald-500/30 transition-colors">
                <Plus className="w-5 h-5 max-[639px]:w-5 max-[639px]:h-5 sm:w-8 sm:h-8 text-emerald-500" />
              </div>
              <h3 className="text-sm max-[639px]:text-sm sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-1 max-[639px]:mb-1 sm:mb-2">
                Join Event
              </h3>
              <p className="text-xs max-[639px]:text-xs sm:text-sm text-muted-foreground text-center">
                Click to join an existing event with an invite code
              </p>
            </div>
          </div>
        ) : (
          <div className="group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg min-h-[150px] max-[639px]:min-h-[140px] sm:min-h-[200px] border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
            <div className="p-3 max-[639px]:p-3 sm:p-6">
              <div className="flex items-center justify-between mb-2 max-[639px]:mb-2 sm:mb-4">
                <h3 className="text-sm max-[639px]:text-sm sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  Join Event
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowJoinForm(false);
                    setInviteCode("");
                  }}
                  className="h-5 w-5 max-[639px]:h-5 max-[639px]:w-5 sm:h-8 sm:w-8 p-0 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/20"
                >
                  <X className="h-3 w-3 max-[639px]:h-3 max-[639px]:w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-[639px]:space-y-2 sm:space-y-4">
                <div>
                  <label className="block text-xs max-[639px]:text-xs sm:text-sm font-medium text-muted-foreground mb-1 max-[639px]:mb-1 sm:mb-2">
                    Invite Code
                  </label>
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter 6-character code"
                    className="bg-background border-emerald-500/30 focus:border-emerald-500 text-center font-mono text-xs max-[639px]:text-xs sm:text-lg tracking-widest h-8 max-[639px]:h-8 sm:h-12"
                    maxLength={6}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && inviteCode.trim().length >= 6 && !isJoining) {
                        e.preventDefault();
                        handleJoinEvent();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Enter the 6-character invite code
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    onClick={handleJoinEvent}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 max-[639px]:h-8 sm:h-10 text-xs max-[639px]:text-xs sm:text-base"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Join Event"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowJoinForm(false);
                      setInviteCode("");
                    }}
                    className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 h-8 max-[639px]:h-8 sm:h-10 px-3 sm:px-4 text-xs max-[639px]:text-xs sm:text-base"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {filteredEvents.length > 0 ? (
          currentPageEvents.map((event) => (
            <Link
              key={event.id}
              href={`/event/${event.id}`} // Link to detail page
              className="block group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <div className="aspect-video relative">
                <Image
                  src={event.image_url || getDefaultImage(event.category)}
                  alt={event.title}
                  fill
                  className="object-cover brightness-90 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute right-2 top-2 space-y-2">
                  {/* Status Badge - Only show if status column exists */}
                  {event.status && (
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-medium border ${getStatusBadge(event.status).className}`}
                    >
                      {getStatusBadge(event.status).label}
                    </div>
                  )}
                  {/* Category Badge */}
                  <div className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                    {event.category}
                  </div>
                </div>
              </div>
              <div className="p-2 max-[639px]:p-2 sm:p-4">
                <h3 className="mb-1 max-[639px]:mb-1 sm:mb-1.5 text-sm max-[639px]:text-sm sm:text-lg font-semibold line-clamp-1">
                  {event.title}
                </h3>
                <p className="text-xs max-[639px]:text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2 max-[639px]:mb-2 sm:mb-3 h-6 max-[639px]:h-6 sm:h-10">
                  {event.description}
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className="break-words">{formatDate(event.date)}</span>
                  </div>
                  <span className="opacity-50 hidden sm:inline">|</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="break-words">{event.location}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <p className="text-lg mb-4">
              {searchTerm || selectedCategories.length > 0
                ? "No events match your search criteria."
                : "No events found. Be the first to create an event!"}
            </p>
            {!searchTerm && selectedCategories.length === 0 && (
              <Button asChild>
                <Link href="/create-event">Create Event</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredEvents.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {(() => {
              const start = (page - 1) * PAGE_SIZE + 1;
              const end = Math.min(page * PAGE_SIZE, filteredEvents.length);
              return `Showing ${start}-${end} of ${filteredEvents.length}`;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Join Event
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to join this event?
            </DialogDescription>
          </DialogHeader>
          
          {eventToJoin && (
            <div className="py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-lg">{eventToJoin.events?.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {eventToJoin.events?.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {eventToJoin.events?.date && formatDate(eventToJoin.events.date)}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {eventToJoin.events?.location}
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm">
                    <span className="font-medium">Role:</span> {eventToJoin.role}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setEventToJoin(null);
              }}
              disabled={isJoining}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmJoinEvent}
              disabled={isJoining}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Yes, Join Event
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Events Page Failsafe Popup */}
      {showFailsafe && user && (
        <EventsPageFailsafePopup
          userId={user.id}
          onSuccess={handleFailsafeSuccess}
          onClose={handleFailsafeClose}
        />
      )}
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading events...</p>
          </div>
        </div>
      </div>
    }>
      <EventsPageContent />
    </Suspense>
  );
}
