"use client"; // Client component

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar,
  MapPin,
  ArrowRight,
  CreditCard,
  BarChart2,
  Smartphone,
  Users,
  Shield,
  Globe,
  Plus,
  Edit,
  ListPlus,
  Tag,
  CheckCircle,
  CheckSquare,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/supabase";
import { format as formatFns } from "date-fns";

type Event = Database["public"]["Tables"]["events"]["Row"];

export default function HomeClient() {
  const router = useRouter();
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<
    { name: string; count: number; color: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [eventCountByDate, setEventCountByDate] = useState<Record<string, number>>({});
  const [eventsByDate, setEventsByDate] = useState<Record<string, { id: string; title: string; date: string }[]>>({});
  
  // Email change confirmation popup state
  const [emailChangePopup, setEmailChangePopup] = useState<{
    show: boolean;
    type: 'current_confirmed' | 'new_confirmed' | 'both_confirmed';
    currentEmail?: string;
    newEmail?: string;
  }>({ show: false, type: 'current_confirmed' });

  // Guard against React StrictMode double-invoking effects in dev
  const hasInitialized = useRef(false);

  const handlePasswordResetConfirmation = useCallback(async (hash: string) => {
    try {
      console.log('Processing password reset confirmation...');
      
      // Extract tokens from hash
      const urlParams = new URLSearchParams(hash.substring(1));
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const type = urlParams.get('type');

      console.log('Tokens extracted:', { 
        accessToken: !!accessToken, 
        refreshToken: !!refreshToken, 
        type 
      });

      if (!accessToken || !refreshToken) {
        throw new Error('Missing authentication tokens');
      }

      console.log('Setting session with Supabase...');
      // Try a simpler approach - just redirect to password reset form
      // The tokens will be handled by the password reset page itself
      console.log('Redirecting directly to password reset form...');
      window.history.replaceState(null, '', '/');
      router.push(`/auth/reset-password?token=${accessToken}&refresh=${refreshToken}`);
      
    } catch (error: any) {
      console.error('Password reset confirmation error:', error);
      // Clear the hash on error
      window.history.replaceState(null, '', '/');
    }
  }, [router]);

  const handleEmailChangeConfirmation = useCallback(async (hash: string) => {
    try {
      console.log('Processing email change confirmation...', hash);
      
      // Extract tokens from hash
      const urlParams = new URLSearchParams(hash.substring(1));
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const type = urlParams.get('type');

      console.log('Extracted tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

      if (!accessToken || !refreshToken) {
        throw new Error('Missing authentication tokens');
      }

      // Set the session with the tokens
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to authenticate');
      }

      if (!sessionData.user) {
        throw new Error('No user found in session');
      }

      console.log('Email change confirmed! Showing popup...', { 
        userEmail: sessionData.user.email,
        type,
        isCurrentEmailConfirmation: type === 'email_change'
      });
      
      // Clear the hash
      window.history.replaceState(null, '', '/');
      
      // Check if this is current email confirmation (has tokens) or new email confirmation (message only)
      const isCurrentEmailConfirmation = type === 'email_change';
      
      if (isCurrentEmailConfirmation) {
        // Current email confirmed - show popup asking to confirm new email
        console.log('Setting popup to current_confirmed');
        setEmailChangePopup({
          show: true,
          type: 'current_confirmed',
          currentEmail: sessionData.user.email || undefined,
          newEmail: sessionData.user.user_metadata?.new_email || undefined
        });
        
        // Store current email confirmation
        localStorage.setItem('emailChange:currentConfirmed', '1');
      } else {
        // This shouldn't happen with token-based links, but handle gracefully
        console.log('Setting popup to new_confirmed');
        setEmailChangePopup({
          show: true,
          type: 'new_confirmed',
          currentEmail: sessionData.user.email || undefined,
          newEmail: sessionData.user.user_metadata?.new_email || undefined
        });
        
        // Store new email confirmation
        localStorage.setItem('emailChange:newConfirmed', '1');
      }
      
    } catch (error: any) {
      console.error('Email change confirmation error:', error);
      // Clear the hash on error
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const handleEmailChangeMessage = useCallback(async (hash: string) => {
    try {
      console.log('Processing email change message...');
      
      // Extract message from hash
      const urlParams = new URLSearchParams(hash.substring(1));
      const message = urlParams.get('message');
      
      if (message && message.includes('Confirmation link accepted')) {
        // This is the new email confirmation message
        console.log('New email confirmation message received');
        
        // Clear the hash
        window.history.replaceState(null, '', '/');
        
        // Check if current email was already confirmed
        const currentEmailConfirmed = localStorage.getItem('emailChange:currentConfirmed') === '1';
        
        if (currentEmailConfirmed) {
          // Both emails confirmed - show completion popup
          setEmailChangePopup({
            show: true,
            type: 'both_confirmed'
          });
          
          // Clear stored confirmation state
          localStorage.removeItem('emailChange:currentConfirmed');
        } else {
          // Only new email confirmed - show popup asking to confirm current email
          setEmailChangePopup({
            show: true,
            type: 'new_confirmed'
          });
          
          // Store new email confirmation
          localStorage.setItem('emailChange:newConfirmed', '1');
        }
      }
      
    } catch (error: any) {
      console.error('Email change message error:', error);
      // Clear the hash on error
      window.history.replaceState(null, '', '/');
    }
  }, []);

  // Handle password reset confirmation directly on homepage when tokens are present
  useEffect(() => {
    const hash = window.location.hash;
    console.log('Homepage hash:', hash);
    console.log('Hash includes access_token:', hash.includes('access_token'));
    console.log('Hash includes type=email_change:', hash.includes('type=email_change'));
    console.log('Hash includes type=recovery:', hash.includes('type=recovery'));
    console.log('Hash includes message=', hash.includes('message='));
    
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      console.log('Password reset tokens detected on homepage - handling confirmation');
      handlePasswordResetConfirmation(hash);
      return;
    }
    if (hash.includes('access_token') && hash.includes('type=email_change')) {
      console.log('Email change tokens detected on homepage - handling confirmation');
      handleEmailChangeConfirmation(hash);
      return;
    }
    if (hash.includes('message=') && hash.includes('Confirmation+link+accepted')) {
      console.log('Email change message detected on homepage - handling message');
      handleEmailChangeMessage(hash);
      return;
    }
  }, [handlePasswordResetConfirmation, handleEmailChangeConfirmation, handleEmailChangeMessage]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    fetchFeaturedEvents();
    fetchCategories();
  }, []);

  const fetchFeaturedEvents = async () => {
    try {
      setIsLoading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setFeaturedEvents([]);
        return;
      }

      // Fetch event IDs the user has joined (member or moderator)
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

      // Merge, de-duplicate, sort by created_at desc, and take top 8
      const mapById = new Map<string, Event>();
      [...(ownEvents || []), ...joinedEvents].forEach((evt) => {
        if (!mapById.has(evt.id)) mapById.set(evt.id, evt);
      });
      const merged = Array.from(mapById.values()).sort((a, b) =>
        new Date(b.created_at as any).getTime() - new Date(a.created_at as any).getTime()
      );

      setFeaturedEvents(merged.slice(0, 8));
    } catch (err: any) {
      console.error("Error fetching featured events:", err);
      setError("Failed to load featured events");
      setFeaturedEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from("events").select("category");

      if (error) throw error;

      // Count events by category and create category objects
      const categoryCounts =
        data?.reduce((acc: { [key: string]: number }, event) => {
          const category = (event as any).category || "Other";
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {}) || {};

      // Convert to array format with colors
      const categoryColors = [
        "bg-purple-500",
        "bg-green-500",
        "bg-green-500",
        "bg-orange-500",
        "bg-pink-500",
        "bg-yellow-500",
        "bg-red-500",
        "bg-indigo-500",
        "bg-teal-500",
      ];

      const categoriesArray = Object.entries(categoryCounts).map(
        ([name, count], index) => ({
          name,
          count: count as number,
          color: categoryColors[index % categoryColors.length],
        })
      );

      setCategories(categoriesArray);
    } catch (err: any) {
      console.error("Error fetching categories:", err);
      // Fallback to default categories if database fails
      setCategories([
        { name: "Music", count: 0, color: "bg-purple-500" },
        { name: "Technology", count: 0, color: "bg-green-500" },
        { name: "Sports", count: 0, color: "bg-green-500" },
        { name: "Food & Drink", count: 0, color: "bg-orange-500" },
        { name: "Arts & Culture", count: 0, color: "bg-pink-500" },
        { name: "Business", count: 0, color: "bg-yellow-500" },
      ]);
    }
  };

  // Build YYYY-MM-DD key in local time
  const buildDateKey = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Fetch counts for the visible month (own + joined events only)
  useEffect(() => {
    const fetchMonthCounts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setEventCountByDate({});
          setEventsByDate({});
          return;
        }

        // Month range (local time)
        const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);

        // Joined events ids
        const { data: collabRows } = await supabase
          .from('event_collaborators')
          .select('event_id')
          .eq('user_id', user.id);
        const joinedIds = (collabRows || []).map((r: any) => r.event_id);
        const joinedCsv = joinedIds.length > 0 ? joinedIds.join(',') : '';

        // Query events in month, created by user or joined
        // Using OR filter to combine own and joined
        let query = supabase
          .from('events')
          .select('id,date,status,user_id,title')
          .gte('date', start.toISOString())
          .lte('date', end.toISOString())
          .not('status', 'in', "('cancelled','archived')");

        if (joinedCsv) {
          query = query.or(`user_id.eq.${user.id},id.in.(${joinedCsv})`);
        } else {
          query = query.eq('user_id', user.id);
        }

        const { data: monthEvents, error: monthErr } = await query;
        if (monthErr) throw monthErr;

        const counts: Record<string, number> = {};
        const grouped: Record<string, { id: string; title: string; date: string }[]> = {};
        (monthEvents || []).forEach((evt: any) => {
          if (!evt?.date) return;
          const d = new Date(evt.date);
          const key = buildDateKey(d);
          counts[key] = (counts[key] || 0) + 1;
          const title = (evt as any).title ?? 'Untitled Event';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({ id: evt.id, title, date: evt.date });
        });
        setEventCountByDate(counts);
        setEventsByDate(grouped);
      } catch (e) {
        // Fail-soft: just clear counts
        setEventCountByDate({});
        setEventsByDate({});
      }
    };

    fetchMonthCounts();
  }, [selectedDate]);

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

  return (
    <>
    <div className="flex flex-col gap-12">
      {/* Hero Section */}
      <section className="relative h-[500px] w-full overflow-hidden rounded-3xl">
        {/* Background Image */}
        <Image
          src="/images/event.webp"
          alt="Events background"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/60 to-green-500/60 backdrop-blur-[2px]" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center text-white">
          <h1 className="mb-6 text-5xl font-bold">Manage Events Effortlessly</h1>
          <p className="mb-8 text-lg">
            Create events, add items and scripts, assign tasks, and track progress
          </p>
        </div>
      </section>

      {/* Large Calendar Section */}
      <section className="rounded-3xl border bg-card p-6 md:p-10">
        <h2 className="text-3xl font-bold mb-6 text-center">Event Calendar</h2>
        <div className="flex flex-col lg:flex-row items-stretch gap-6">
          {/* Big date display */}
          <div className="flex-1 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border px-6 py-10 md:py-14">
            <div className="text-center">
              <div className="uppercase tracking-widest text-sm text-muted-foreground mb-2">
                {formatFns(selectedDate, "EEEE")} {/* Day of week */}
              </div>
              <div className="flex items-end justify-center gap-4">
                <div className="text-6xl md:text-7xl font-extrabold leading-none">
                  {formatFns(selectedDate, "d")}
                </div>
                <div className="text-left pb-1">
                  <div className="text-2xl md:text-3xl font-semibold">
                    {formatFns(selectedDate, "MMMM")}
                  </div>
                  <div className="text-lg md:text-xl text-muted-foreground">
                    {formatFns(selectedDate, "yyyy")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="w-full lg:w-[420px] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous Day
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))}
              >
                Next Day <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {/* Month/Year pickers (sync both calendars) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Pick a month</label>
                <select
                  className="w-full h-10 rounded-md border bg-background"
                  value={selectedDate.getMonth()}
                  onChange={(e) => {
                    const m = parseInt(e.target.value, 10);
                    setSelectedDate((d) => new Date(d.getFullYear(), m, Math.min(d.getDate(), 28)));
                  }}
                >
                  {[
                    'January','February','March','April','May','June','July','August','September','October','November','December'
                  ].map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Pick a year</label>
                <select
                  className="w-full h-10 rounded-md border bg-background"
                  value={selectedDate.getFullYear()}
                  onChange={(e) => {
                    const y = parseInt(e.target.value, 10);
                    setSelectedDate((d) => new Date(y, d.getMonth(), Math.min(d.getDate(), 28)));
                  }}
                >
                  {Array.from({ length: 11 }).map((_, i) => {
                    const y = new Date().getFullYear() - 5 + i;
                    return (
                      <option key={y} value={y}>{y}</option>
                    );
                  })}
                </select>
              </div>
            </div>
            {/* Selected day events summary */}
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              {(() => {
                const key = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;
                const count = eventCountByDate[key] || 0;
                if (count === 0) return <span className="text-muted-foreground">No events on this day.</span>;
                const titles = (eventsByDate as any)?.[key]?.map((e: any) => e.title) || [];
                const firstThree = titles.slice(0, 3);
                const overflow = Math.max(0, titles.length - firstThree.length);
                return (
                  <div className="space-y-1">
                    <div className="font-medium">{count} {count === 1 ? 'Event' : 'Events'}</div>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {firstThree.map((t: string, i: number) => (
                        <li key={i} className="truncate">{t}</li>
                      ))}
                      {overflow > 0 && (
                        <li className="truncate">+{overflow} more</li>
                      )}
                    </ul>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Month grid calendar (standalone) */}
        <div className="mt-6 rounded-2xl border bg-muted/40 p-4">
          {/* Lazy import to avoid SSR issues */}
          {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
          {(() => {
            const MonthGrid = require("@/components/home/month-grid-calendar").default;
            const getEventsCountForDate = (d: Date) => {
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const key = `${yyyy}-${mm}-${dd}`;
              return eventCountByDate[key] || 0;
            };
            return (
              <MonthGrid
                selected={selectedDate}
                onSelect={(d: Date | undefined) => d && setSelectedDate(d)}
                getEventsCountForDate={getEventsCountForDate}
              />
            );
          })()}
        </div>
      </section>

      {/* How to Use EventSphere Section */}
      <section>
        <h2 className="text-center text-3xl font-bold mb-12">
          How to Use EventSphere
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-green-500/10 hover:bg-green-500/5 hover:border-green-500/20 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="mb-4 p-4 rounded-full bg-green-500/10">
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-green-400">
              Step 1: Go to Event Page
            </h3>
            <p className="text-green-300">
              Navigate to the events page to start creating your event
            </p>
          </div>
          {/* Step 2 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-amber-500/10 hover:bg-amber-500/5 hover:border-amber-500/20 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="mb-4 p-4 rounded-full bg-amber-500/10">
              <Plus className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-amber-400">
              Step 2: Create Event
            </h3>
            <p className="text-amber-300">
              Click the create event button to start setting up your event
            </p>
          </div>
          {/* Step 3 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-green-500/10 hover:bg-green-500/5 hover:border-green-500/20 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="mb-4 p-4 rounded-full bg-green-500/10">
              <Edit className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-green-400">
              Step 3: Fill Details
            </h3>
            <p className="text-green-300">
              Enter all necessary information about your event
            </p>
          </div>
          {/* Step 4 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-amber-500/10 hover:bg-amber-500/5 hover:border-amber-500/20 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="mb-4 p-4 rounded-full bg-amber-500/10">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-amber-400">
              Step 4: Set Event Time
            </h3>
            <p className="text-amber-300">
              Choose the date and time for your event
            </p>
          </div>
          {/* Step 5 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-green-500/10 hover:bg-green-500/5 hover:border-green-500/20 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="mb-4 p-4 rounded-full bg-green-500/10">
              <ListPlus className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-green-400">
              Step 5: Add Items
            </h3>
            <p className="text-green-300">
              Add required items like balloons, chairs, or any event supplies
            </p>
          </div>
          {/* Step 6 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-amber-500/10 hover:bg-amber-500/5 hover:border-amber-500/20 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="mb-4 p-4 rounded-full bg-amber-500/10">
              <Tag className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-amber-400">
              Step 6: Label Items
            </h3>
            <p className="text-amber-300">
              Organize and label each item for better management
            </p>
          </div>
          {/* Step 7 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-green-500/10 hover:bg-green-500/5 hover:border-green-500/20 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="mb-4 p-4 rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-green-400">
              Step 7: Confirm
            </h3>
            <p className="text-green-300">
              Review and confirm all event details and items
            </p>
          </div>
          {/* Step 8 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-amber-500/10 hover:bg-amber-500/5 hover:border-amber-500/20 hover:scale-105 transition-all duration-300 cursor-pointer">
            <div className="mb-4 p-4 rounded-full bg-amber-500/10">
              <CheckSquare className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-amber-400">
              Step 8: Track Progress
            </h3>
            <p className="text-amber-300">
              Monitor and mark items as they are completed
            </p>
          </div>
        </div>
      </section>

      {/* Featured Events Section - CSS Marquee */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold">Featured Events</h2>
          <Button variant="ghost" className="gap-2" asChild>
            <Link href="/events">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">
              Loading events...
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={fetchFeaturedEvents}
            >
              Try Again
            </Button>
          </div>
        ) : featuredEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No events found. Be the first to create an event!</p>
            <Button asChild className="mt-4">
              <Link href="/create-event">Create Event</Link>
            </Button>
          </div>
        ) : (
          /* Outer container for overflow and hover pause */
          <div className="group w-full overflow-hidden">
            {/* Inner track with animation */}
            <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
              {featuredEvents.map((event, index) => (
                // Individual event card
                <div
                  key={`${event.id}-${index}`}
                  className="w-80 flex-shrink-0 px-3"
                >
                  <Link
                    href={`/event/${event.id}`}
                    className="block group/card relative overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:scale-105"
                  >
                    <div className="aspect-video relative">
                      <Image
                        src={
                          event.image_url ||
                          getDefaultImage((event as any).category)
                        }
                        alt={event.title}
                        fill
                        className="object-cover brightness-75 transition-transform duration-300"
                        priority={index < 4}
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="mb-2 text-xl font-semibold line-clamp-1">
                        {event.title}
                      </h3>
                      <p className="text-sm text-gray-400 line-clamp-2 mb-3 h-10">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
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
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Call to Action Section */}
      <section className="rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-background p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-lg text-muted-foreground mb-6">
          Join thousands of event organizers and attendees on EventSphere
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            asChild
            className="hover:shadow-[0_0_20px_rgba(34,197,94,0.6)] hover:shadow-green-400 transition-all duration-300"
          >
            <Link href="/create-event">Create an Event</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-green-400/50 transition-all duration-300"
          >
            <Link href="/events">Browse Events</Link>
          </Button>
        </div>
      </section>
    </div>

    {/* Email Change Confirmation Popup */}
    <Dialog open={emailChangePopup.show} onOpenChange={(open) => setEmailChangePopup(prev => ({ ...prev, show: open }))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Email Change Confirmation
          </DialogTitle>
        </DialogHeader>
        <DialogDescription className="space-y-4">
          {emailChangePopup.type === 'current_confirmed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Current email confirmed!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Current email confirmed! Please check your new email and click the confirmation link to complete the email change process.
              </p>
            </div>
          )}
          
          {emailChangePopup.type === 'new_confirmed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">New email confirmed!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                New email confirmed! Please check your current email and click the confirmation link to complete the email change process.
              </p>
            </div>
          )}
          
          {emailChangePopup.type === 'both_confirmed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Email change confirmed!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Both emails have been confirmed. Your email change is now complete. Please refresh the page and wait for changes - it may take a while to propagate.
              </p>
              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg">
                <RefreshCw className="h-4 w-4" />
                <span className="text-sm">Changes are being processed...</span>
              </div>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => setEmailChangePopup(prev => ({ ...prev, show: false }))}
              className="flex-1"
            >
              Got it
            </Button>
            {emailChangePopup.type === 'both_confirmed' && (
              <Button 
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                Refresh Page
              </Button>
            )}
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
    </>
  );
}
