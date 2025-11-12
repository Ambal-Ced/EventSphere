// Server Component - fetches data using React's cache()
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AnalyticsClient from "./analytics-client";

type EventRow = {
  id: string;
  title: string;
  date: string | null;
  user_id: string;
  category?: string;
  markup_type?: "percentage" | "fixed";
  markup_value?: number;
  discount_type?: "none" | "percentage" | "fixed";
  discount_value?: number;
};

type EventItem = {
  event_id: string;
  cost?: number;
  item_quantity?: number;
};

// Cached data fetching functions using React's cache()
// This ensures data is only fetched once per render pass
const getCachedUser = cache(async () => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

const getCachedAnalyticsData = cache(async (userId: string, scope: "owned" | "joined" | "both" = "both") => {
  const supabase = createServerSupabaseClient();
  
  // Fetch owned events
  const ownedPromise = scope !== "joined" 
    ? supabase
            .from("events")
            .select("id,title,date,user_id,category,markup_type,markup_value,discount_type,discount_value")
        .eq("user_id", userId)
    : Promise.resolve({ data: [] });

  // Fetch collaborations
  const collabPromise = scope !== "owned"
    ? supabase
            .from("event_collaborators")
            .select("event_id")
        .eq("user_id", userId)
    : Promise.resolve({ data: [] });

  const [ownedResult, collabResult] = await Promise.all([ownedPromise, collabPromise]);
  
  const ownedEvents = (ownedResult.data || []) as EventRow[];
  const collabRows = collabResult.data || [];
  
  // Try RPC fallback if no collaborations found
  let joinedIds: string[] = collabRows.map((r: any) => r.event_id);
  if (joinedIds.length === 0 && scope !== "owned") {
    const { data: rpcData } = await supabase.rpc("get_user_collaborations", { p_user_id: userId });
            joinedIds = (rpcData || []).map((r: any) => r.event_id || r.id).filter(Boolean);
          }

  // Fetch joined events
  let joinedEvents: EventRow[] = [];
          if (joinedIds.length > 0) {
    const { data } = await supabase
              .from("events")
              .select("id,title,date,user_id,category,markup_type,markup_value,discount_type,discount_value")
              .in("id", joinedIds);
    joinedEvents = (data || []) as EventRow[];
        }

  // Combine events based on scope
        const all = scope === "owned"
          ? ownedEvents
          : scope === "joined"
          ? joinedEvents
          : Array.from(new Map([...ownedEvents, ...joinedEvents].map((e: any) => [e.id, e])).values());

  // Fetch related data if events exist
  let items: EventItem[] = [];
  let attStats: { event_id: string; expected_attendees: number; event_attendees: number }[] = [];
  let feedback: { event_id: string; rating: number; sentiment?: string }[] = [];

        if (all.length > 0) {
    const eventIds = all.map((e) => e.id);
    
    const [itemsResult, attResult, fbResult] = await Promise.all([
      supabase
            .from("event_items")
            .select("event_id,cost,item_quantity")
        .in("event_id", eventIds),
      supabase
            .from("attendees")
            .select("event_id,expected_attendees,event_attendees")
        .in("event_id", eventIds),
      supabase
            .from("feedback_responses")
            .select("event_id,rating,sentiment")
        .in("event_id", eventIds),
    ]);

    items = (itemsResult.data || []) as EventItem[];
    attStats = (attResult.data || []) as any;
    feedback = (fbResult.data || []) as any;
    }

    return {
    events: all,
    items,
    attStats,
    feedback,
  };
});

export default async function AnalyticsPage() {
  // Get user (cached per render pass)
  const user = await getCachedUser();
  
      if (!user) {
    redirect("/login");
  }

  // Fetch analytics data (cached per render pass)
  // Default to "both" scope for initial load
  const { events, items, attStats, feedback } = await getCachedAnalyticsData(user.id, "both");

  return (
    <AnalyticsClient
      initialEvents={events}
      initialItems={items}
      initialAttStats={attStats}
      initialFeedback={feedback}
    />
  );
}
