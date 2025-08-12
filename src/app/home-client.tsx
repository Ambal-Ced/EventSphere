"use client"; // Client component

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/supabase";

type Event = Database["public"]["Tables"]["events"]["Row"];

export default function HomeClient() {
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<
    { name: string; count: number; color: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard against React StrictMode double-invoking effects in dev
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    fetchFeaturedEvents();
    fetchCategories();
  }, []);

  const fetchFeaturedEvents = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      setFeaturedEvents(data || []);
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
      const { data, error } = await supabase.from("events").select("type");

      if (error) throw error;

      // Count events by type and create category objects
      const categoryCounts =
        data?.reduce((acc: { [key: string]: number }, event) => {
          const type = (event as any).type || "Other";
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}) || {};

      // Convert to array format with colors
      const categoryColors = [
        "bg-purple-500",
        "bg-blue-500",
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
        { name: "Technology", count: 0, color: "bg-blue-500" },
        { name: "Sports", count: 0, color: "bg-green-500" },
        { name: "Food & Drink", count: 0, color: "bg-orange-500" },
        { name: "Arts & Culture", count: 0, color: "bg-pink-500" },
        { name: "Business", count: 0, color: "bg-yellow-500" },
      ]);
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

  return (
    <div className="flex flex-col gap-12">
      {/* Hero Section */}
      <section className="relative h-[500px] w-full overflow-hidden rounded-3xl">
        {/* Background Image */}
        <Image
          src="/images/event.jpg"
          alt="Events background"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/60 to-blue-500/60 backdrop-blur-[2px]" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center text-white">
          <h1 className="mb-6 text-5xl font-bold">
            Discover Amazing Events Near You
          </h1>
          <p className="mb-8 text-lg">
            Find and book tickets for the best events in your area
          </p>
          <div className="flex w-full max-w-2xl items-center gap-2 rounded-full bg-white/10 p-2 backdrop-blur-md">
            <Search className="ml-4 h-5 w-5 text-white" />
            <Input
              type="text"
              placeholder="Search events, venues, or artists..."
              className="border-0 bg-transparent text-white placeholder:text-white/70 focus-visible:ring-0"
            />
            <Button
              size="lg"
              className="rounded-full bg-white text-primary hover:bg-white/90"
            >
              Search Events
            </Button>
          </div>
        </div>
      </section>

      {/* How to Use EventSphere Section */}
      <section>
        <h2 className="text-center text-3xl font-bold mb-12">
          How to Use EventSphere
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="mb-4 p-4 rounded-full bg-primary/10">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Step 1: Go to Event Page
            </h3>
            <p className="text-muted-foreground">
              Navigate to the events page to start creating your event
            </p>
          </div>
          {/* Step 2 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="mb-4 p-4 rounded-full bg-primary/10">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Step 2: Create Event</h3>
            <p className="text-muted-foreground">
              Click the create event button to start setting up your event
            </p>
          </div>
          {/* Step 3 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="mb-4 p-4 rounded-full bg-primary/10">
              <Edit className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Step 3: Fill Details</h3>
            <p className="text-muted-foreground">
              Enter all necessary information about your event
            </p>
          </div>
          {/* Step 4 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="mb-4 p-4 rounded-full bg-primary/10">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Step 4: Set Event Time
            </h3>
            <p className="text-muted-foreground">
              Choose the date and time for your event
            </p>
          </div>
          {/* Step 5 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="mb-4 p-4 rounded-full bg-primary/10">
              <ListPlus className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Step 5: Add Items</h3>
            <p className="text-muted-foreground">
              Add required items like balloons, chairs, or any event supplies
            </p>
          </div>
          {/* Step 6 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="mb-4 p-4 rounded-full bg-primary/10">
              <Tag className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Step 6: Label Items</h3>
            <p className="text-muted-foreground">
              Organize and label each item for better management
            </p>
          </div>
          {/* Step 7 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="mb-4 p-4 rounded-full bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Step 7: Confirm</h3>
            <p className="text-muted-foreground">
              Review and confirm all event details and items
            </p>
          </div>
          {/* Step 8 */}
          <div className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors">
            <div className="mb-4 p-4 rounded-full bg-primary/10">
              <CheckSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Step 8: Track Progress
            </h3>
            <p className="text-muted-foreground">
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
                          getDefaultImage((event as any).type)
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
          <Button size="lg" asChild>
            <Link href="/create-event">Create an Event</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/events">Browse Events</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
