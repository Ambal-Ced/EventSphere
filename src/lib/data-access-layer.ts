/**
 * Data Access Layer (DAL)
 * Centralized data access logic for all database operations
 * This layer abstracts database queries and provides a consistent API
 */

import { supabase } from "@/lib/supabase";
import { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];

/**
 * User/Profile Data Access
 */
export class UserDataAccess {
  /**
   * Get user profile by ID
   */
  static async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    return data ?? null;
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: Partial<Tables["profiles"]["Row"]>) {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get current user session (client-side only)
   */
  static async getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }

  /**
   * Get current user (client-side only)
   */
  static async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }
}

/**
 * Event Data Access
 */
export class EventDataAccess {
  /**
   * Get event by ID
   */
  static async getEvent(eventId: string) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get events by user ID
   */
  static async getEventsByUserId(userId: string, options?: {
    includeCancelled?: boolean;
    orderBy?: string;
    ascending?: boolean;
  }) {
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
  }

  /**
   * Get public events
   */
  static async getPublicEvents(options?: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
  }) {
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
  }

  /**
   * Create event
   */
  static async createEvent(eventData: Tables["events"]["Insert"]) {
    const { data, error } = await supabase
      .from("events")
      .insert(eventData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update event
   */
  static async updateEvent(eventId: string, updates: Partial<Tables["events"]["Row"]>) {
    const { data, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete event
   */
  static async deleteEvent(eventId: string) {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (error) throw error;
  }
}

/**
 * Notification Data Access
 */
export class NotificationDataAccess {
  /**
   * Get notifications for user
   */
  static async getNotifications(userId: string, options?: {
    limit?: number;
    unreadOnly?: boolean;
  }) {
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
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) throw error;
  }
}

/**
 * Analytics Data Access
 */
export class AnalyticsDataAccess {
  /**
   * Get event analytics
   */
  static async getEventAnalytics(eventId: string, userId: string) {
    // Verify user has access to this event
    const { data: event } = await supabase
      .from("events")
      .select("user_id")
      .eq("id", eventId)
      .single();

    if (!event || event.user_id !== userId) {
      throw new Error("Unauthorized");
    }

    // Get analytics data
    const [attendance, feedback, items] = await Promise.all([
      supabase.from("attendance_portals").select("*").eq("event_id", eventId),
      supabase.from("feedback_portals").select("*").eq("event_id", eventId),
      supabase
        .from("event_items")
        .select("*")
        .eq("event_id", eventId),
    ]);

    return {
      attendance: attendance.data,
      feedback: feedback.data,
      items: items.data,
    };
  }
}

/**
 * Subscription Data Access
 */
export class SubscriptionDataAccess {
  /**
   * Get user subscription
   */
  static async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  }
}

