/**
 * Server-Side Data Access Layer
 * Uses React's cache() function to ensure data is only fetched once per render pass
 * This is for Server Components only
 */

import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];

/**
 * Get user session (cached per render pass)
 * This ensures only one session fetch per render pass
 */
export const getCachedUserSession = cache(async () => {
  const supabase = createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
});

/**
 * Get user profile (cached per render pass)
 */
export const getCachedUserProfile = cache(async (userId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
});

/**
 * Get events by user ID (cached per render pass)
 */
export const getCachedUserEvents = cache(async (userId: string, options?: {
  includeCancelled?: boolean;
  orderBy?: string;
  ascending?: boolean;
}) => {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("events")
    .select("*")
    .eq("user_id", userId);

  if (!options?.includeCancelled) {
    query = query.not("status", "eq", "cancelled");
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
});

/**
 * Get public events (cached per render pass)
 */
export const getCachedPublicEvents = cache(async (options?: {
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
}) => {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("events")
    .select("*")
    .eq("is_public", true)
    .neq("status", "cancelled");

  if (options?.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? true });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
});

/**
 * Get event by ID (cached per render pass)
 */
export const getCachedEvent = cache(async (eventId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) throw error;
  return data;
});

/**
 * Get user's event collaborations (cached per render pass)
 */
export const getCachedUserCollaborations = cache(async (userId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("event_collaborators")
    .select("event_id")
    .eq("user_id", userId);

  if (error) throw error;
  return data;
});

/**
 * Get events for analytics (cached per render pass)
 * Fetches both owned and joined events
 */
export const getCachedAnalyticsEvents = cache(async (userId: string, scope: "owned" | "joined" | "both" = "both") => {
  const supabase = createServerSupabaseClient();
  
  const [ownedEvents, collaborations] = await Promise.all([
    scope !== "joined" 
      ? supabase
          .from("events")
          .select("id,title,date,user_id,category,markup_type,markup_value,discount_type,discount_value")
          .eq("user_id", userId)
      : Promise.resolve({ data: [] }),
    scope !== "owned"
      ? supabase
          .from("event_collaborators")
          .select("event_id")
          .eq("user_id", userId)
      : Promise.resolve({ data: [] }),
  ]);

  let joinedEvents: any[] = [];
  if (collaborations.data && collaborations.data.length > 0) {
    const joinedIds = collaborations.data.map((r: any) => r.event_id);
    const { data } = await supabase
      .from("events")
      .select("id,title,date,user_id,category,markup_type,markup_value,discount_type,discount_value")
      .in("id", joinedIds);
    joinedEvents = data || [];
  }

  const all = scope === "owned"
    ? ownedEvents.data || []
    : scope === "joined"
    ? joinedEvents
    : Array.from(new Map([...(ownedEvents.data || []), ...joinedEvents].map((e: any) => [e.id, e])).values());

  return all;
});

/**
 * Get notifications for user (cached per render pass)
 */
export const getCachedNotifications = cache(async (userId: string, options?: {
  limit?: number;
  unreadOnly?: boolean;
}) => {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId);

  if (options?.unreadOnly) {
    query = query.is("read_at", null);
  }

  query = query.order("created_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
});

