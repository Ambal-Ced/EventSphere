"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  CalendarDays,
  MapPin,
  Users,
  PlusCircle,
  Frown,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// Interface matching the events table structure (adjust if needed)
interface Event {
  id: string;
  user_id?: string | null;
  owner_id?: string | null;
  title: string;
  description: string | null;
  date: string | null; // Supabase returns timestampz as string
  location: string | null;
  category?: string | null; // Use category to match database schema
  image_url: string | null;
  created_at: string;
  updated_at: string;
  status?: string | null;
  role?: string | null;
  // Add attendees if you have a way to calculate/store this, otherwise remove
  // attendees: number;
}

export default function MyEventsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Join event state
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const fetchMyEvents = async () => {
    try {
      setIsLoading(true);
      setError(null); // Clear any previous errors

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch events that are NOT archived, cancelled, or deleted
      // These events should not appear in "My Events" but are kept for analytics
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .not("status", "in", "('archived', 'cancelled')")
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching events:", error);
        setEvents([]);
        setError(null); // Don't show error, just show "no events" message
      } else {
        setEvents(data || []);
        setError(null);
      }
    } catch (err: any) {
      console.error("Error fetching my events:", err);
      // Don't set error state, just show empty events list
      setEvents([]);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyEvents();

    // Check if there's an invite code in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      setInviteCode(code);
      setShowJoinForm(true);
    }
  }, [router]);

  const handleJoinEvent = async () => {
    if (!inviteCode.trim()) {
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
      fetchMyEvents();
    } catch (error: any) {
      toast.error(error.message || "Failed to join event");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Created Events</h1>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/create-event">
              {" "}
              {/* Ensure this route exists */}
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Event
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center">Loading your events...</div>
      ) : events.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50 p-8 text-center">
          <Frown className="mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 text-xl font-semibold">No events yet</h3>
          <p className="mb-4 text-muted-foreground">
            You haven't created any events yet. Get started by creating your
            first event!
          </p>
          <Button asChild>
            <Link href="/create-event">Create Your First Event</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Join Event Card */}
          {!showJoinForm ? (
            <div
              className="group relative overflow-hidden rounded-lg border bg-card transition-all duration-300 hover:shadow-md cursor-pointer min-h-[200px] flex flex-col items-center justify-center p-6 border-dashed border-emerald-500/40 hover:border-emerald-500/60 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
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
            <div className="group relative overflow-hidden rounded-lg border bg-card transition-all duration-300 hover:shadow-md min-h-[200px] border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setInviteCode(e.target.value)
                      }
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

          {events.map((event) => (
            <div
              key={event.id}
              className="group relative overflow-hidden rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              {event.image_url && (
                <div className="absolute inset-0 z-0 opacity-10 transition-opacity group-hover:opacity-20">
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="relative z-10 flex h-full flex-col">
                <h3 className="mb-2 text-xl font-semibold group-hover:text-primary">
                  {event.title}
                </h3>
                <p className="mb-4 line-clamp-3 flex-grow text-sm text-muted-foreground">
                  {event.description || "No description provided."}
                </p>
                <div className="mt-auto space-y-2 border-t pt-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CalendarDays className="mr-2 h-4 w-4 flex-shrink-0" />
                    {event.date
                      ? format(new Date(event.date), "PPP p")
                      : "Date TBD"}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4 flex-shrink-0" />
                    {event.location || "Location TBD"}
                  </div>
                  {/* Add attendees count if available */}
                  {/* <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4 flex-shrink-0" />
                    {event.attendees} attendees
                  </div> */}
                </div>
                <div className="mt-4 flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/event/${event.id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
