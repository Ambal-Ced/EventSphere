import { supabase } from '@/lib/supabase';

export interface AccountDeletionRequest {
  id: string;
  user_id: string;
  user_email: string;
  requested_at: string;
  scheduled_deletion_date: string;
  cancelled_at: string | null;
  deleted_at: string | null;
  status: 'pending' | 'approved' | 'cancelled' | 'completed';
  deletion_reason: string | null;
  created_at: string;
  updated_at: string;
}

export class AccountDeletionService {
  /**
   * Request account deletion
   */
  static async requestAccountDeletion(
    userId: string,
    userEmail: string,
    reason?: string
  ): Promise<AccountDeletionRequest | null> {
    try {
      console.log('🗑️ Requesting account deletion for user:', userId);

      // Calculate scheduled deletion date (7+ business days)
      const scheduledDate = await this.calculateScheduledDeletionDate();

      const { data, error } = await supabase
        .from('account_deletion_requests')
        .insert({
          user_id: userId,
          user_email: userEmail,
          scheduled_deletion_date: scheduledDate,
          deletion_reason: reason || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error requesting account deletion:', error);
        throw error;
      }

      console.log('✅ Account deletion requested:', {
        scheduledDate: scheduledDate,
        requestId: data.id
      });

      return data;
    } catch (error) {
      console.error('❌ Error in requestAccountDeletion:', error);
      return null;
    }
  }

  /**
   * Get user's deletion request status
   */
  static async getDeletionRequest(userId: string): Promise<AccountDeletionRequest | null> {
    try {
      const { data, error } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching deletion request:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Error in getDeletionRequest:', error);
      return null;
    }
  }

  /**
   * Cancel account deletion - deletes the request from database
   */
  static async cancelDeletionRequest(userId: string): Promise<boolean> {
    try {
      console.log('🔄 Cancelling account deletion for user:', userId);

      // Delete the request from database (not just update status)
      const { error } = await supabase
        .from('account_deletion_requests')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error cancelling deletion request:', error);
        throw error;
      }

      console.log('✅ Account deletion request removed from database');
      return true;
    } catch (error) {
      console.error('❌ Error in cancelDeletionRequest:', error);
      return false;
    }
  }

  /**
   * Calculate scheduled deletion date (7+ business days from now)
   */
  static async calculateScheduledDeletionDate(): Promise<string> {
    try {
      // Call the database function to calculate business days
      const { data, error } = await supabase.rpc('calculate_scheduled_deletion_date');

      if (error) {
        console.error('❌ Error calculating scheduled date, using fallback:', error);
        // Fallback: Add 7 business days manually
        return this.calculateBusinessDaysFallback(7);
      }

      return data;
    } catch (error) {
      console.error('❌ Error in calculateScheduledDeletionDate:', error);
      return this.calculateBusinessDaysFallback(7);
    }
  }

  /**
   * Fallback method to calculate business days
   */
  static calculateBusinessDaysFallback(businessDays: number): string {
    let currentDate = new Date();
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      currentDate.setDate(currentDate.getDate() + 1);
      // Check if it's a weekday (Monday = 1, Sunday = 7)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        daysAdded++;
      }
    }

    // Set to 5 PM on the scheduled date
    currentDate.setHours(17, 0, 0, 0);
    return currentDate.toISOString();
  }

  /**
   * Check if email was previously deleted (prevents free trial abuse)
   */
  static async wasEmailPreviouslyDeleted(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('was_email_previously_deleted', {
        p_email: email
      });

      if (error) {
        console.error('❌ Error checking email deletion history:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('❌ Error in wasEmailPreviouslyDeleted:', error);
      return false;
    }
  }

  /**
   * Get days until deletion
   */
  static getDaysUntilDeletion(scheduledDate: string): number {
    const scheduled = new Date(scheduledDate);
    const now = new Date();
    const diffTime = scheduled.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Format scheduled deletion date for display
   */
  static formatScheduledDate(scheduledDate: string): string {
    const date = new Date(scheduledDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get pending deletion requests (for admin use only - not implemented yet)
   */
  static async getPendingDeletionRequests(): Promise<AccountDeletionRequest[]> {
    try {
      const { data, error } = await supabase.rpc('get_pending_deletion_requests');

      if (error) {
        console.error('❌ Error fetching pending deletion requests:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error in getPendingDeletionRequests:', error);
      return [];
    }
  }
}

