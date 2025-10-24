"use client";

import { useState, useEffect, useMemo } from "react";
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
  Search,
  ListFilter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventCreatedLimitsCard } from "@/components/ui/event-created-limits-card";
import { LimitExceededWarningCard } from "@/components/ui/limit-exceeded-warning-card";
import { LoadingPopup } from "@/components/ui/loading-popup";

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
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Loading state for navigation
  const [isNavigating, setIsNavigating] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;


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
        setCategories([]);
        setError(null); // Don't show error, just show "no events" message
      } else {
        const eventsData = data || [];
        setEvents(eventsData);
        setError(null);
        
        // Extract unique categories from events
        const uniqueCategories = [
          ...new Set(eventsData.map((event) => event.category).filter(Boolean) as string[]),
        ];
        setCategories(uniqueCategories);
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
  }, [router]);

  // Memoized filtering logic
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        searchTerm === "" ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        selectedCategories.length === 0 ||
        (event.category && selectedCategories.includes(event.category));

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategories, events]);

  // Reset to first page on filter/search change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategories]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  }, [filteredEvents.length]);

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

  // Handler for navigation with loading
  const handleNavigate = (href: string) => {
    setIsNavigating(true);
    router.push(href);
  };


  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-2xl max-[639px]:text-xl sm:text-3xl font-bold mb-3">My Events</h1>
        <div className="flex flex-col max-[374px]:flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search events..."
              className="pl-8 w-full sm:w-[200px] md:w-[250px] lg:w-[300px] bg-background text-xs max-[639px]:text-xs sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category, !!checked)
                  }
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
            <Button 
              size="sm" 
              className="h-8 max-[639px]:h-7 sm:h-9 gap-1 flex-1 max-[374px]:w-full sm:w-auto text-xs max-[639px]:text-xs sm:text-base"
              onClick={() => handleNavigate("/create-event")}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="max-[374px]:inline sm:inline">
                Create Event
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Limit Exceeded Warning Card */}
      <div className="mb-6">
        <LimitExceededWarningCard />
      </div>

      {/* Event Created Limits Card */}
      <div className="mb-6">
        <EventCreatedLimitsCard />
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
      ) : filteredEvents.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50 p-8 text-center">
          <Frown className="mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 text-xl font-semibold">No events match your search</h3>
          <p className="mb-4 text-muted-foreground">
            {searchTerm || selectedCategories.length > 0
              ? "Try adjusting your search terms or filters."
              : "You haven't created any events yet."}
          </p>
          {(searchTerm || selectedCategories.length > 0) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                setSearchTerm("");
                setSelectedCategories([]);
                      }}
                    >
              Clear Filters
                    </Button>
          )}
                  </div>
      ) : (
        <div className="grid gap-3 max-[639px]:gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {currentPageEvents.map((event) => (
            <div
              key={event.id}
              className="group relative overflow-hidden rounded-lg border bg-card p-3 max-[639px]:p-3 sm:p-5 shadow-sm transition-shadow hover:shadow-md"
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
                <h3 className="mb-1 max-[639px]:mb-1 sm:mb-2 text-lg max-[639px]:text-lg sm:text-xl font-semibold group-hover:text-primary">
                  {event.title}
                </h3>
                <p className="mb-3 max-[639px]:mb-3 sm:mb-4 line-clamp-3 flex-grow text-xs max-[639px]:text-xs sm:text-sm text-muted-foreground">
                  {event.description || "No description provided."}
                </p>
                <div className="mt-auto space-y-1 max-[639px]:space-y-1 sm:space-y-2 border-t pt-3 max-[639px]:pt-3 sm:pt-4">
                  <div className="flex items-center text-xs max-[639px]:text-xs sm:text-sm text-muted-foreground">
                    <CalendarDays className="mr-1 max-[639px]:mr-1 sm:mr-2 h-3 max-[639px]:h-3 sm:h-4 w-3 max-[639px]:w-3 sm:w-4 flex-shrink-0" />
                    <span className="break-words">{event.date
                      ? format(new Date(event.date), "PPP p")
                      : "Date TBD"}</span>
                  </div>
                  <div className="flex items-center text-xs max-[639px]:text-xs sm:text-sm text-muted-foreground">
                    <MapPin className="mr-1 max-[639px]:mr-1 sm:mr-2 h-3 max-[639px]:h-3 sm:h-4 w-3 max-[639px]:w-3 sm:w-4 flex-shrink-0" />
                    <span className="break-words">{event.location || "Location TBD"}</span>
                  </div>
                </div>
                <div className="mt-3 max-[639px]:mt-3 sm:mt-4 flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 max-[639px]:h-8 sm:h-9 text-xs max-[639px]:text-xs sm:text-sm"
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
      {/* Pagination Controls */}
      {filteredEvents.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs max-[639px]:text-xs sm:text-sm text-muted-foreground">
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
              className="h-8 max-[639px]:h-8 sm:h-9 text-xs max-[639px]:text-xs sm:text-sm"
            >
              Prev
            </Button>
            <span className="text-xs max-[639px]:text-xs sm:text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 max-[639px]:h-8 sm:h-9 text-xs max-[639px]:text-xs sm:text-sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}
      
      {/* Loading Popup */}
      <LoadingPopup 
        isOpen={isNavigating}
        title="Loading Create Event Page"
        description="Please wait while we prepare the event creation form..."
      />
    </div>
  );
}
