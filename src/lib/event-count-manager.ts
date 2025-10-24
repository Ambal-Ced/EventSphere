"use client";

import { supabase } from "@/lib/supabase";

export interface EventCounts {
  eventsCreated: number;
  eventsJoined: number;
}

export class EventCountManager {
  /**
   * Get current event counts for a user
   */
  static async getEventCounts(userId: string): Promise<EventCounts> {
    try {
      console.log("📊 Getting event counts for user:", userId);

      // Get events created by user
      const { data: createdEvents, error: createdError } = await supabase
        .from("events")
        .select("id")
        .eq("created_by", userId);

      if (createdError) {
        console.error("❌ Error fetching created events:", createdError);
      }

      // Get events joined by user (from attendance_records)
      const { data: joinedEvents, error: joinedError } = await supabase
        .from("attendance_records")
        .select("event_id")
        .eq("user_id", userId)
        .eq("status", "confirmed");

      if (joinedError) {
        console.error("❌ Error fetching joined events:", joinedError);
      }

      const eventsCreated = createdEvents?.length || 0;
      const eventsJoined = joinedEvents?.length || 0;

      console.log("📊 Event counts:", { eventsCreated, eventsJoined });

      return {
        eventsCreated,
        eventsJoined
      };
    } catch (error) {
      console.error("❌ Error getting event counts:", error);
      return { eventsCreated: 0, eventsJoined: 0 };
    }
  }

  /**
   * Update event counts after an event is created
   */
  static async onEventCreated(userId: string): Promise<void> {
    console.log("✅ Event created by user:", userId);
    // The counts will be updated automatically on next fetch
  }

  /**
   * Update event counts after an event is joined
   */
  static async onEventJoined(userId: string, eventId: string): Promise<void> {
    try {
      console.log("✅ User joined event:", { userId, eventId });

      // Create attendance record
      const { error } = await supabase
        .from("attendance_records")
        .insert({
          user_id: userId,
          event_id: eventId,
          status: "confirmed",
          joined_at: new Date().toISOString()
        });

      if (error) {
        console.error("❌ Error creating attendance record:", error);
        throw error;
      }

      console.log("✅ Attendance record created successfully");
    } catch (error) {
      console.error("❌ Error in onEventJoined:", error);
      throw error;
    }
  }

  /**
   * Update event counts after an event is left
   */
  static async onEventLeft(userId: string, eventId: string): Promise<void> {
    try {
      console.log("👋 User left event:", { userId, eventId });

      // Update attendance record status to 'left'
      const { error } = await supabase
        .from("attendance_records")
        .update({
          status: "left",
          left_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("event_id", eventId);

      if (error) {
        console.error("❌ Error updating attendance record:", error);
        throw error;
      }

      console.log("✅ Attendance record updated to 'left'");
    } catch (error) {
      console.error("❌ Error in onEventLeft:", error);
      throw error;
    }
  }

  /**
   * Update event counts after an event is deleted
   */
  static async onEventDeleted(eventId: string, createdBy: string): Promise<void> {
    try {
      console.log("🗑️ Event deleted:", { eventId, createdBy });

      // Update all attendance records for this event to 'cancelled'
      const { error } = await supabase
        .from("attendance_records")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString()
        })
        .eq("event_id", eventId);

      if (error) {
        console.error("❌ Error updating attendance records:", error);
        throw error;
      }

      console.log("✅ All attendance records updated to 'cancelled'");
    } catch (error) {
      console.error("❌ Error in onEventDeleted:", error);
      throw error;
    }
  }

  /**
   * Check if user can create more events
   */
  static async canCreateEvent(userId: string, maxEvents: number = 10): Promise<boolean> {
    const counts = await this.getEventCounts(userId);
    return counts.eventsCreated < maxEvents;
  }

  /**
   * Check if user can join more events
   */
  static async canJoinEvent(userId: string, maxEvents: number = 10): Promise<boolean> {
    const counts = await this.getEventCounts(userId);
    return counts.eventsJoined < maxEvents;
  }
}
