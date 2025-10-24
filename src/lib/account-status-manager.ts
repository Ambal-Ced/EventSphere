import { supabase } from '@/lib/supabase';

export class AccountStatusManager {
  /**
   * Add new account status when user verifies email
   */
  static async addNewAccountStatus(userId: string): Promise<boolean> {
    console.log('🆕 Adding new account status for user:', userId);

    try {
      const { error } = await supabase.rpc('add_new_account_status', {
        user_id: userId
      });

      if (error) {
        console.error('❌ Error adding new account status:', error);
        return false;
      }

      console.log('✅ New account status added successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception adding new account status:', error);
      return false;
    }
  }

  /**
   * Check if user is a new account eligible for trial
   */
  static async isUserNewAccount(userId: string): Promise<boolean> {
    console.log('🔍 Checking if user is new account:', userId);

    try {
      const { data, error } = await supabase.rpc('is_user_new_account', {
        user_id: userId
      });

      if (error) {
        console.error('❌ Error checking new account status:', error);
        return false;
      }

      const isNew = data as boolean;
      console.log('📊 New account status:', isNew);
      return isNew;
    } catch (error) {
      console.error('❌ Exception checking new account status:', error);
      return false;
    }
  }

  /**
   * Activate 1-month free trial for new account
   */
  static async activateNewAccountTrial(userId: string): Promise<string | null> {
    console.log('🚀 Activating new account trial for user:', userId);

    try {
      const { data, error } = await supabase.rpc('activate_new_account_trial', {
        user_id: userId
      });

      console.log('📊 Trial activation response:', { data, error });

      if (error) {
        console.error('❌ Error activating new account trial:', error);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return null;
      }

      const trialId = data as string;
      console.log('✅ New account trial activated successfully! Trial ID:', trialId);
      console.log('🎉 User now has 1-month free trial access to Small Event Org features');
      return trialId;
    } catch (error) {
      console.error('❌ Exception during new account trial activation:', error);
      return null;
    }
  }

  /**
   * Get account status for user
   */
  static async getAccountStatus(userId: string): Promise<any | null> {
    console.log('📊 Getting account status for user:', userId);

    try {
      const { data, error } = await supabase
        .from('account_status')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        return null;
      }

      console.log('✅ Account status retrieved:', data);
      return data;
    } catch (error) {
      console.error('❌ Exception getting account status:', error);
      return null;
    }
  }
}
