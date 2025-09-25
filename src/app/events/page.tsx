"use client"; // Make it a Client Component

import { useState, useMemo, useEffect } from "react"; // Import hooks
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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/supabase";

type Event = Database["public"]["Tables"]["events"]["Row"];

// Note: Cannot export metadata from a Client Component.
// Move metadata to layout.tsx or a dedicated server component if needed.
// export const metadata: Metadata = {
//   title: "Browse Events - EventSphere",
//   description: "Find and join upcoming events on EventSphere",
// };

export default function EventsPage() {
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Join event state
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetchEvents();

    // Check if there's an invite code in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      setInviteCode(code);
      setShowJoinForm(true);
    }

    // Set up interval to check and update event statuses
    const statusInterval = setInterval(() => {
      updateEventStatuses();
    }, 60000); // Check every minute

    return () => clearInterval(statusInterval);
  }, []);

  // Function to update event statuses automatically
  const updateEventStatuses = async () => {
    try {
      // Check if status column exists first
      const { data: testEvent } = await supabase
        .from("events")
        .select("status")
        .limit(1);

      if (!testEvent || testEvent.length === 0) {
        // No events or status column doesn't exist yet
        return;
      }

      const now = new Date();

      // Update events that should change status
      const { data: eventsToUpdate } = await supabase
        .from("events")
        .select("id, date, status")
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
      const [{ data: collabRows, error: collabError }, { data: ownEvents, error: ownError }] = await Promise.all([
        supabase
          .from("event_collaborators")
          .select("event_id")
          .eq("user_id", user.id),
        supabase
        .from("events")
        .select("*")
          .eq("user_id", user.id)
          .not("status", "in", "('cancelled', 'archived')"),
      ]);

      if (collabError) throw collabError;
      if (ownError) throw ownError;

      const joinedEventIds = (collabRows || []).map((r) => r.event_id);

      let joinedEvents: Event[] = [];
      if (joinedEventIds.length > 0) {
        const { data: joinedData, error: joinedError } = await supabase
          .from("events")
          .select("*")
          .in("id", joinedEventIds)
          .not("status", "in", "('cancelled', 'archived')");
        if (joinedError) throw joinedError;
        joinedEvents = joinedData || [];
      }

      // Merge results, de-duplicate, and sort by date ascending
      const mapById = new Map<string, Event>();
      [...(ownEvents || []), ...joinedEvents].forEach((evt) => {
        if (!mapById.has(evt.id)) mapById.set(evt.id, evt);
      });
      const merged = Array.from(mapById.values()).sort(
        (a, b) => new Date(a.date as any).getTime() - new Date(b.date as any).getTime()
      );

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
    if (!inviteCode.trim()) {
      // You can add toast notification here if you have it
      toast.error("Please enter an invite code");
      return;
    }

    setIsJoining(true);
    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to join an event");
      }

      // Find the invite
      const { data: inviteData, error: inviteError } = await supabase
        .from("event_invites")
        .select(
          `
          *,
          events:event_id(*)
        `
        )
        .eq("invite_code", inviteCode.trim())
        .eq("is_active", true)
        .single();

      if (inviteError || !inviteData) {
        throw new Error("Invalid or expired invite code");
      }

      // Check if invite has expired
      if (new Date(inviteData.expires_at) < new Date()) {
        throw new Error("This invite code has expired");
      }

      // Check if user has already used this invite
      if (inviteData.current_uses >= inviteData.max_uses) {
        throw new Error("This invite code has reached its maximum usage limit");
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("event_collaborators")
        .select("*")
        .eq("event_id", inviteData.event_id)
        .eq("user_id", user.id)
        .single();

      if (existingMember) {
        throw new Error("You are already a member of this event");
      }

      // Add user to event collaborators
      const { error: joinError } = await supabase
        .from("event_collaborators")
        .insert({
          event_id: inviteData.event_id,
          user_id: user.id,
          role: inviteData.role,
        });

      if (joinError) throw joinError;

      // Update invite usage
      await supabase
        .from("event_invites")
        .update({ current_uses: inviteData.current_uses + 1 })
        .eq("id", inviteData.id);

      toast.success(`Successfully joined the event as a ${inviteData.role}!`);

      // Reset form and hide it
      setInviteCode("");
      setShowJoinForm(false);

      // Refresh events to show the newly joined event
      fetchEvents();
    } catch (error: any) {
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
      Technology: "/images/tech-conf.png",
      Music: "/images/music-fest.jpg",
      "Food & Drink": "/images/food-expo.png",
      // Use existing images for other types
      "Arts & Culture": "/images/event.jpg",
      Business: "/images/tech-conf.png",
      Gaming: "/images/event.jpg",
      Health: "/images/event.jpg",
      Film: "/images/event.jpg",
    };
    return typeImages[type] || "/images/event.jpg";
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-bold">Browse Events</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search events..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px] bg-background"
              value={searchTerm} // Bind value to state
              onChange={(e) => setSearchTerm(e.target.value)} // Update state on change
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <ListFilter className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Filter ({selectedCategories.length}) {/* Show count */}
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

          <Button asChild size="sm" className="h-9 gap-1">
            <Link href="/create-event">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Create Event
              </span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Events Grid - Render filteredEvents */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Join Event Card */}
        {!showJoinForm ? (
          <div
            className="group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer min-h-[200px] flex flex-col items-center justify-center p-6 border-dashed border-emerald-500/40 hover:border-emerald-500/60 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
            onClick={() => setShowJoinForm(true)}
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 mx-auto group-hover:bg-emerald-500/30 transition-colors">
                <Plus className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                Join Event
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Click to join an existing event with an invite code
              </p>
            </div>
          </div>
        ) : (
          <div className="group relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg min-h-[200px] border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  Join Event
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowJoinForm(false);
                    setInviteCode("");
                  }}
                  className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Invite Code
                  </label>
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter 6-character code"
                    className="bg-background border-emerald-500/30 focus:border-emerald-500 text-center font-mono text-lg tracking-widest h-12"
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Enter the 6-character invite code
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleJoinEvent}
                    disabled={isJoining || !inviteCode.trim()}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-10"
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
                    className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 h-10 px-4"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
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
              <div className="p-4">
                <h3 className="mb-1.5 text-lg font-semibold line-clamp-1">
                  {event.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3 h-10">
                  {event.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(event.date)}
                  </div>
                  <span className="opacity-50">|</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.location}
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
    </div>
  );
}
