import { supabase } from '@/lib/supabase';
import { DefaultSubscriptionManager } from '@/lib/default-subscription-manager';

export class AccountStatusManager {
  /**
   * Add new account status when user verifies email
   */
  static async addNewAccountStatus(userId: string): Promise<boolean> {
    console.log('🆕 Adding new account status for user:', userId);

    try {
      // Use direct insert with ON CONFLICT to handle duplicates
      const { data, error } = await supabase
        .from('account_status')
        .upsert({
          user_id: userId,
          new_account: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select('id'); // Return the created/updated record

      if (error) {
        console.error('❌ Error adding new account status:', error);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return false;
      }

      console.log('✅ New account status added successfully:', data);
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
      const { data, error } = await supabase
        .from('account_status')
        .select('new_account')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 errors

      if (error) {
        console.error('❌ Error checking new account status:', error);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return false;
      }

      // If no record exists, user is not a new account
      if (!data) {
        console.log('📊 No account status record found - user is not new account');
        return false;
      }

      const isNewAccount = data.new_account ?? false;
      console.log('📊 User new account status:', isNewAccount);
      return isNewAccount;
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
      // Use DefaultSubscriptionManager to activate trial
      const success = await DefaultSubscriptionManager.activateTrialSubscription(userId);
      
      if (!success) {
        console.error('❌ Failed to activate trial subscription');
        return null;
      }

      // Update account status to mark as no longer new (set new_account = false)
      console.log('🔄 Setting new_account to false for user:', userId);
      const { error: statusError } = await supabase
        .from('account_status')
        .update({ 
          new_account: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (statusError) {
        console.error('❌ Error updating account status:', statusError);
        // Don't fail the whole operation for this
      } else {
        console.log('✅ Account status updated: new_account set to false');
      }

      console.log('✅ New account trial activated successfully!');
      console.log('🎉 User now has 30-day free trial access to Small Event Org features');
      return 'trial-activated';
    } catch (error) {
      console.error('❌ Exception during new account trial activation:', error);
      return null;
    }
  }

  /**
   * Test function to debug account status operations
   */
  static async testAccountStatusOperations(userId: string): Promise<void> {
    console.log('🧪 Testing account status operations for user:', userId);
    
    try {
      // Test 1: Check if user exists in auth.users
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      console.log('🔐 Current auth user:', authUser?.user?.id);
      console.log('🔐 Auth error:', authError);
      
      // Test 2: Try to insert a test record
      console.log('📝 Testing insert operation...');
      const { data: insertData, error: insertError } = await supabase
        .from('account_status')
        .insert({
          user_id: userId,
          new_account: true
        })
        .select('id');
      
      console.log('📝 Insert result:', { data: insertData, error: insertError });
      
      // Test 3: Try to select the record
      console.log('🔍 Testing select operation...');
      const { data: selectData, error: selectError } = await supabase
        .from('account_status')
        .select('*')
        .eq('user_id', userId);
      
      console.log('🔍 Select result:', { data: selectData, error: selectError });
      
    } catch (error) {
      console.error('❌ Test operation failed:', error);
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
