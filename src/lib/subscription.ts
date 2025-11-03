import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { SubscriptionNotificationService } from './subscription-notification-service';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];
type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row'];
type UserUsage = Database['public']['Tables']['user_usage']['Row'];
type BillingHistory = Database['public']['Tables']['billing_history']['Row'];

// Extended type that includes the subscription_plans relation
type UserSubscriptionWithPlan = UserSubscription & {
  subscription_plans: SubscriptionPlan | null;
};

export interface SubscriptionLimits {
  ai_insights_overall: number;
  ai_insights_per_event: number;
  ai_chat: number;
  invite_people: number;
  events: number;
  joinable_events: number;
}

export interface SubscriptionFeatures {
  ai_insights: boolean;
  ai_chat: boolean;
  events: boolean;
  invitations: boolean;
  fast_ai_access?: boolean;
  high_priority_ai?: boolean;
}

/**
 * Generate invoice number client-side to avoid slow database trigger
 * Format: INV-YYYYMMDD-HHMMSS-XXX
 * This uses timestamp to ensure uniqueness without database lookups
 * The database trigger will skip if invoice_number is already provided
 */
function generateInvoiceNumber(): string {
  // Use timestamp-based approach for uniqueness
  // Format: INV-YYYYMMDD-HHMMSS-XXX
  // This ensures uniqueness without database lookup
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  // Format: INV-YYYYMMDD-HHMMSS-XXX
  // This format ensures uniqueness and bypasses the slow database trigger
  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

export class SubscriptionService {
  /**
   * Get user's current active subscription
   */
  static async getUserSubscription(userId: string): Promise<UserSubscriptionWithPlan | null> {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          name,
          features,
          limits,
          price_cents,
          currency
        )
      `)
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .gt('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching user subscription:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all available subscription plans
   */
  static async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    console.log('📋 Fetching subscription plans from database...');
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_cents', { ascending: true });

    if (error) {
      console.error('❌ Error fetching subscription plans:', error);
      return [];
    }

    console.log('✅ Subscription plans fetched:', data?.length || 0);
    return data || [];
  }

  /**
   * Get user's usage for a specific action type
   */
  static async getUserUsage(userId: string, actionType: string, eventId?: string): Promise<number> {
    const { data, error } = await supabase
      .from('user_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_type', actionType)
      .eq('event_id', eventId || null)
      .single();

    if (error) {
      return 0;
    }

    return data?.count || 0;
  }

  /**
   * Record usage for a user
   */
  static async recordUsage(
    userId: string, 
    actionType: string, 
    eventId?: string, 
    count: number = 1
  ): Promise<void> {
    const { error } = await supabase
      .from('user_usage')
      .upsert({
        user_id: userId,
        usage_type: actionType,
        event_id: eventId || null,
        count: count,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      });

    if (error) {
      console.error('Error recording usage:', error);
    }
  }


  /**
   * Create or update subscription for a user
   */
  static async createSubscription(
    userId: string,
    planIdOrName: string,
    stripeSubscriptionId?: string,
    stripeCustomerId?: string,
    transactionDetails?: {
      netAmountCents: number;
      paymentMethodBrand?: string;
      paymentMethodLast4?: string;
      paymongoPaymentId?: string;
      paymongoPaymentIntentId?: string;
      originalAmountCents: number;
    }
  ): Promise<UserSubscription | null> {
    console.log('🔐 Creating/updating subscription:', {
      userId,
      planIdOrName,
      planIdOrNameType: typeof planIdOrName,
      planIdOrNameLength: planIdOrName?.length,
      stripeSubscriptionId,
      stripeCustomerId
    });

    // First, check if user already has ANY subscription (regardless of status)
    // Always update existing subscription, only create if user has NO subscriptions
    console.log('🔍 Checking for existing subscription...');
    const { data: existingSubscriptions, error: existingError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId) // Find ANY subscription for this user (no status filter)
      .order('created_at', { ascending: false }); // Get most recent subscription

    if (existingError) {
      console.error('❌ Error checking existing subscription:', existingError);
      return null;
    }

    const existingSubscription = existingSubscriptions && existingSubscriptions.length > 0 ? existingSubscriptions[0] : null;
    
    console.log('🔍 Existing subscription check result:', {
      found: !!existingSubscription,
      subscriptionId: existingSubscription?.id,
      currentPlanId: existingSubscription?.plan_id,
      status: existingSubscription?.status,
      isTrialing: existingSubscription?.status === 'trialing',
      isActive: existingSubscription?.status === 'active'
    });

    // Get plan details - try by ID first, then by name
    let plan = null;
    let planError = null;

    // First try to find by ID
    console.log(`🔍 Looking up plan by ID: "${planIdOrName}"`);
    const { data: planById, error: planByIdError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planIdOrName)
      .single();

    console.log(`🔍 Plan by ID result:`, { planById, planByIdError });

    if (planById && !planByIdError) {
      plan = planById;
      console.log('📋 Plan found by ID:', plan);
    } else {
      // Try to find by name
      console.log(`🔍 Plan not found by ID, trying by name: "${planIdOrName}"`);
      const { data: planByName, error: planByNameError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('name', planIdOrName)
        .single();

      console.log(`🔍 Plan by name result:`, { planByName, planByNameError });

      if (planByName && !planByNameError) {
        plan = planByName;
        console.log('📋 Plan found by name:', plan);
      } else {
        planError = planByNameError;
        console.error('❌ Error fetching plan by name:', planByNameError);
      }
    }

    if (planError || !plan) {
      console.error('❌ Error fetching plan:', planError);
      return null;
    }

    // Calculate billing period based on plan type
    const now = new Date();
    const periodEnd = new Date(now);
    
    // Normalize plan name for comparison (trim whitespace and convert to lowercase)
    const normalizedPlanName = plan.name?.trim().toLowerCase();
    
    if (normalizedPlanName === 'free') {
      // Free tier has no expiry (forever)
      periodEnd.setFullYear(periodEnd.getFullYear() + 100);
    } else {
      // All other plans (Free Trial, Small Event Org, Large Event Org) are 30 days
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

    console.log('📅 Billing period calculation:', {
      planName: plan.name,
      planNameLength: plan.name?.length,
      planNameTrimmed: plan.name?.trim(),
      normalizedPlanName: normalizedPlanName,
      isFreePlan: normalizedPlanName === 'free',
      start: now.toISOString(),
      end: periodEnd.toISOString(),
      period: normalizedPlanName === 'free' ? 'No expiry (Free tier)' : '30 days',
      daysAdded: normalizedPlanName === 'free' ? 36500 : 30
    });

    // Prepare subscription data - handle transition from trialing/cancelled to active
    const subscriptionData: any = {
      user_id: userId,
      plan_id: plan.id, // Use the actual plan ID from database (could be 111... or 222...)
      status: 'active', // Always set to active when purchasing (even if was trialing/cancelled)
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      cancel_at_period_end: false, // Clear any cancellation flags
      cancelled_at: null // Clear any cancellation timestamp
    };

    // If updating from a trialing subscription, clear trial-related fields
    if (existingSubscription && existingSubscription.status === 'trialing') {
      console.log('🔄 Converting trialing subscription to paid subscription');
      subscriptionData.is_trial = false;
      subscriptionData.trial_start = null;
      subscriptionData.trial_end = null;
    } else if (existingSubscription && existingSubscription.status === 'cancelled') {
      console.log('🔄 Reactivating cancelled subscription');
      subscriptionData.is_trial = false; // Ensure not trial
      subscriptionData.trial_start = null;
      subscriptionData.trial_end = null;
    }

    if (existingSubscription) {
      // Update existing subscription (could be Free, trialing, or active)
      console.log('🔄 Updating existing subscription:', {
        subscriptionId: existingSubscription.id,
        currentPlanId: existingSubscription.plan_id,
        currentStatus: existingSubscription.status,
        newPlanId: plan.id,
        newPlanName: plan.name,
        isTrialConversion: existingSubscription.status === 'trialing',
        subscriptionData: subscriptionData
      });

      // Add timeout to update operation
      const updatePromise = supabase
        .from('user_subscriptions')
        .update(subscriptionData)
        .eq('id', existingSubscription.id)
        .select()
        .single();

      const updateTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Subscription update timeout after 30 seconds')), 30000)
      );

      let data, error;
      try {
        const result = await Promise.race([updatePromise, updateTimeoutPromise]) as any;
        if (result instanceof Error && result.message.includes('timeout')) {
          error = result;
          console.error('❌ Subscription update timed out:', result);
        } else if (result && typeof result === 'object') {
          data = result.data;
          error = result.error;
        } else {
          error = new Error('Unexpected result format from subscription update');
        }
      } catch (timeoutError: any) {
        error = timeoutError instanceof Error ? timeoutError : new Error(String(timeoutError));
        console.error('❌ Subscription update operation timed out:', timeoutError);
      }

      if (error) {
        console.error('❌ Error updating subscription:', error);
        console.error('❌ Update query details:', {
          subscriptionId: existingSubscription.id,
          subscriptionData: subscriptionData
        });
        return null;
      }

      console.log('✅ Subscription updated successfully:', data);
      
      // Transaction recording is handled separately in the payment page
      // The transaction is created first with subscription_id: null, then updated with the subscription_id
      return data;
    } else {
      // Create new subscription
      console.log('🆕 Creating new subscription...');
      console.log('💾 Inserting subscription data:', subscriptionData);

      // Add timeout to insert operation
      const insertPromise = supabase
        .from('user_subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

      const insertTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Subscription insert timeout after 30 seconds')), 30000)
      );

      let data, error;
      try {
        const result = await Promise.race([insertPromise, insertTimeoutPromise]) as any;
        if (result instanceof Error && result.message.includes('timeout')) {
          error = result;
          console.error('❌ Subscription insert timed out:', result);
        } else if (result && typeof result === 'object') {
          data = result.data;
          error = result.error;
        } else {
          error = new Error('Unexpected result format from subscription insert');
        }
      } catch (timeoutError: any) {
        error = timeoutError instanceof Error ? timeoutError : new Error(String(timeoutError));
        console.error('❌ Subscription insert operation timed out:', timeoutError);
      }

      if (error) {
        console.error('❌ Error creating subscription:', error);
        console.error('❌ Insert query details:', {
          subscriptionData: subscriptionData
        });
        return null;
      }

      console.log('✅ Subscription created successfully:', data);
      
      // Transaction creation is now handled directly in the payment page
      // This ensures transactions are always recorded even if subscription creation fails
      console.log('✅ Subscription created successfully - transaction should be created separately');
      
      return data;
    }
  }

  /**
   * Update transaction record with subscription ID
   */
  static async updateTransactionSubscriptionId(transactionId: string, subscriptionId: string): Promise<boolean> {
    console.log('🔄 Updating transaction with subscription ID:', { transactionId, subscriptionId });
    
    const { error } = await supabase
      .from('transactions')
      .update({ subscription_id: subscriptionId })
      .eq('id', transactionId);

    if (error) {
      console.error('❌ Error updating transaction subscription ID:', error);
      return false;
    }

    console.log('✅ Transaction updated with subscription ID successfully');
    return true;
  }

  /**
   * Create a transaction record directly (standalone function for payment page)
   */
  static async createTransactionDirect(transactionData: {
    userId: string;
    subscriptionId?: string;
    planName: string;
    originalAmountCents: number;
    netAmountCents: number;
    paymentMethodBrand?: string;
    paymentMethodLast4?: string;
    paymongoPaymentId?: string;
    paymongoPaymentIntentId?: string;
    transactionType?: 'purchase' | 'cancellation' | 'refund';
  }): Promise<any> {
    console.log('💰 Creating transaction record directly:', transactionData);
    console.log('🔍 Transaction data validation:', {
      userId: transactionData.userId,
      planName: transactionData.planName,
      originalAmountCents: transactionData.originalAmountCents,
      netAmountCents: transactionData.netAmountCents,
      paymentMethodBrand: transactionData.paymentMethodBrand,
      paymentMethodLast4: transactionData.paymentMethodLast4,
      paymongoPaymentId: transactionData.paymongoPaymentId,
      paymongoPaymentIntentId: transactionData.paymongoPaymentIntentId,
      transactionType: transactionData.transactionType
    });

    const isCancellation = transactionData.transactionType === 'cancellation' || 
                          transactionData.planName.includes('Cancelled') ||
                          transactionData.planName.includes('Expired');

    // Generate invoice number client-side to avoid slow database trigger
    const invoiceNumber = generateInvoiceNumber();
    
    const transactionRecord = {
      user_id: transactionData.userId,
      subscription_id: transactionData.subscriptionId || null,
      invoice_number: invoiceNumber, // Pre-generate to bypass slow trigger
      original_amount_cents: transactionData.originalAmountCents,
      net_amount_cents: transactionData.originalAmountCents, // Use plan price for admin tracking
      currency: 'PHP',
      payment_method_type: isCancellation ? null : 'card',
      payment_method_brand: isCancellation ? null : transactionData.paymentMethodBrand,
      payment_method_last4: isCancellation ? null : transactionData.paymentMethodLast4,
      paymongo_payment_id: isCancellation ? null : transactionData.paymongoPaymentId,
      paymongo_payment_intent_id: isCancellation ? null : transactionData.paymongoPaymentIntentId,
      status: isCancellation ? 'cancelled' : 'paid',
      transaction_type: isCancellation ? 'cancellation' : 'purchase',
      plan_name: transactionData.planName,
      metadata: {
        plan_name: transactionData.planName,
        plan_amount: transactionData.originalAmountCents,
        paymongo_net_amount: transactionData.netAmountCents,
        payment_method: transactionData.paymentMethodBrand,
        created_at: new Date().toISOString(),
        is_cancellation: isCancellation,
        created_directly: true // Flag to indicate this was created directly from payment page
      }
    };

    console.log('💾 Inserting transaction record directly:', transactionRecord);
    console.log('🔍 About to call Supabase insert...');
    
    // Increase timeout to 20 seconds for better reliability
    const insertPromise = supabase
      .from('transactions')
      .insert(transactionRecord)
      .select()
      .single();

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Supabase insert timeout after 20 seconds')), 20000)
    );

    console.log('🔍 Starting Supabase insert with timeout...');
    let data, error;
    try {
      const result = await Promise.race([insertPromise, timeoutPromise]) as any;
      // Check if result is a timeout error (string message)
      if (result instanceof Error && result.message.includes('timeout')) {
        error = result;
        console.error('❌ Insert operation timed out:', result);
      } else if (result && typeof result === 'object') {
        // Normal Supabase response
        data = result.data;
        error = result.error;
      } else {
        // Unexpected result format
        error = new Error('Unexpected result format from Supabase insert');
        console.error('❌ Unexpected result format:', result);
      }
    } catch (timeoutError: any) {
      // Handle timeout specifically
      error = timeoutError instanceof Error ? timeoutError : new Error(String(timeoutError));
      console.error('❌ Insert operation timed out:', timeoutError);
    }

    console.log('🔍 Supabase insert result:', { data, error });

    if (error) {
      console.error('❌ Error creating transaction record directly:', error);
      console.error('❌ Transaction record that failed:', transactionRecord);
      
      // Check if it's a table doesn't exist error
      if (error.message && error.message.includes('relation "transactions" does not exist')) {
        console.error('❌ Transactions table does not exist! Please run the database/create_transactions_table.sql script first.');
        throw new Error('Transactions table does not exist. Please run the database creation script first.');
      }
      
      throw error;
    }

    console.log('✅ Transaction record created successfully:', data);
    return data;
  }

  /**
   * Create a transaction record for admin tracking and billing history
   */
  static async createTransaction(transactionData: {
    userId: string;
    subscriptionId: string;
    planName: string;
    originalAmountCents: number;
    netAmountCents: number;
    paymentMethodBrand?: string;
    paymentMethodLast4?: string;
    paymongoPaymentId?: string;
    paymongoPaymentIntentId?: string;
    transactionType?: 'purchase' | 'cancellation' | 'refund';
  }): Promise<any> {
    console.log('💰 Creating transaction record:', transactionData);

    const isCancellation = transactionData.transactionType === 'cancellation' || 
                          transactionData.planName.includes('Cancelled') ||
                          transactionData.planName.includes('Expired');

    const transactionRecord = {
      user_id: transactionData.userId,
      subscription_id: transactionData.subscriptionId,
      original_amount_cents: transactionData.originalAmountCents, // Plan price (₱159, ₱300)
      net_amount_cents: transactionData.originalAmountCents, // Use plan price for admin tracking (not PayMongo net)
      currency: 'PHP',
      payment_method_type: isCancellation ? null : 'card',
      payment_method_brand: isCancellation ? null : transactionData.paymentMethodBrand,
      payment_method_last4: isCancellation ? null : transactionData.paymentMethodLast4,
      paymongo_payment_id: isCancellation ? null : transactionData.paymongoPaymentId,
      paymongo_payment_intent_id: isCancellation ? null : transactionData.paymongoPaymentIntentId,
      status: isCancellation ? 'cancelled' : 'paid',
      transaction_type: isCancellation ? 'cancellation' : 'purchase',
      plan_name: transactionData.planName,
      metadata: {
        plan_name: transactionData.planName,
        plan_amount: transactionData.originalAmountCents, // Plan price for admin
        paymongo_net_amount: transactionData.netAmountCents, // Actual PayMongo amount (internal only)
        payment_method: transactionData.paymentMethodBrand,
        created_at: new Date().toISOString(),
        is_cancellation: isCancellation
      }
    };

    console.log('💾 Inserting transaction record:', transactionRecord);
    
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionRecord)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating transaction record:', error);
      console.error('❌ Transaction record that failed:', transactionRecord);
      throw error; // Throw to ensure transaction failure is propagated
    }

    console.log('✅ Transaction record created successfully:', data);
    return data;
  }

  /**
   * Get user's billing history (transactions)
   */
  static async getBillingHistory(userId: string): Promise<any[]> {
    console.log('📊 Fetching billing history for user:', userId);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching billing history:', error);
      return [];
    }

    console.log('✅ Billing history fetched successfully:', data?.length || 0, 'transactions');
    return data || [];
  }

  /**
   * Auto-cancel expired subscriptions (30 days)
   */
  static async autoCancelExpiredSubscriptions(): Promise<{ cancelled: number; errors: number }> {
    console.log('🔄 Checking for expired subscriptions...');
    
    const now = new Date();
    let cancelled = 0;
    let errors = 0;

    try {
      // Find all active subscriptions that have expired
      const { data: expiredSubscriptions, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            price_cents
          )
        `)
        .eq('status', 'active')
        .lt('current_period_end', now.toISOString());

      if (fetchError) {
        console.error('❌ Error fetching expired subscriptions:', fetchError);
        return { cancelled: 0, errors: 1 };
      }

      if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
        console.log('✅ No expired subscriptions found');
        return { cancelled: 0, errors: 0 };
      }

      console.log(`📊 Found ${expiredSubscriptions.length} expired subscriptions`);

      // Cancel each expired subscription
      for (const subscription of expiredSubscriptions) {
        try {
          const { error: cancelError } = await supabase
            .from('user_subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: now.toISOString(),
              cancel_at_period_end: false
            })
            .eq('id', subscription.id);

          if (cancelError) {
            console.error(`❌ Error cancelling subscription ${subscription.id}:`, cancelError);
            errors++;
          } else {
            console.log(`✅ Auto-cancelled expired subscription: ${subscription.id}`);
            cancelled++;

            // Create a cancellation transaction record
            await this.createTransaction({
              userId: subscription.user_id,
              subscriptionId: subscription.id,
              planName: 'Expired Subscription',
              originalAmountCents: 0,
              netAmountCents: 0,
              paymongoPaymentId: undefined,
              paymongoPaymentIntentId: undefined
            });

            // Update the transaction to reflect cancellation
            await supabase
              .from('transactions')
              .update({
                status: 'cancelled',
                transaction_type: 'cancellation',
                metadata: {
                  ...subscription,
                  auto_cancelled: true,
                  cancelled_at: now.toISOString(),
                  reason: 'subscription_expired'
                }
              })
              .eq('subscription_id', subscription.id)
              .eq('transaction_type', 'purchase');

            // Downgrade user to Free tier
            await this.downgradeToFreeTier(subscription.user_id);
          }
        } catch (error) {
          console.error(`❌ Error processing subscription ${subscription.id}:`, error);
          errors++;
        }
      }

      console.log(`✅ Auto-cancellation completed: ${cancelled} cancelled, ${errors} errors`);
      return { cancelled, errors };

    } catch (error) {
      console.error('❌ Error in auto-cancel expired subscriptions:', error);
      return { cancelled: 0, errors: 1 };
    }
  }

  /**
   * Downgrade user to Free tier
   */
  static async downgradeToFreeTier(userId: string): Promise<boolean> {
    console.log('🔄 Downgrading user to Free tier:', userId);

    try {
      // First, clean up any duplicate subscriptions
      await this.cleanupDuplicateSubscriptions(userId);

      // Get the Free plan
      const { data: freePlan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('name', 'Free')
        .single();

      if (planError || !freePlan) {
        console.error('❌ Error fetching Free plan:', planError);
        return false;
      }

      // Calculate Free tier expiry (no expiry - 100 years)
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 100);

      // Update existing subscription to Free tier instead of creating new one
      const { data: freeSubscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: freePlan.id,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          stripe_subscription_id: null,
          stripe_customer_id: null,
          cancel_at_period_end: false,
          cancelled_at: null
        })
        .eq('user_id', userId)
        .eq('status', 'active')
        .select()
        .single();

      if (subscriptionError) {
        console.error('❌ Error updating subscription to Free tier:', subscriptionError);
        return false;
      }

      console.log('✅ User downgraded to Free tier successfully:', freeSubscription.id);
      return true;

    } catch (error) {
      console.error('❌ Error downgrading to Free tier:', error);
      return false;
    }
  }

  /**
   * Clean up duplicate subscriptions for a user (keep only the most recent active one)
   */
  static async cleanupDuplicateSubscriptions(userId: string): Promise<boolean> {
    console.log('🧹 Cleaning up duplicate subscriptions for user:', userId);

    try {
      // Get all subscriptions for the user, ordered by creation date
      const { data: subscriptions, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('❌ Error fetching subscriptions for cleanup:', fetchError);
        return false;
      }

      if (!subscriptions || subscriptions.length <= 1) {
        console.log('✅ No duplicate subscriptions found');
        return true;
      }

      console.log(`🔍 Found ${subscriptions.length} subscriptions, keeping the most recent one`);

      // Keep the first (most recent) subscription, delete the rest
      const subscriptionsToDelete = subscriptions.slice(1);
      
      for (const subscription of subscriptionsToDelete) {
        const { error: deleteError } = await supabase
          .from('user_subscriptions')
          .delete()
          .eq('id', subscription.id);

        if (deleteError) {
          console.error(`❌ Error deleting duplicate subscription ${subscription.id}:`, deleteError);
        } else {
          console.log(`✅ Deleted duplicate subscription ${subscription.id}`);
        }
      }

      console.log('✅ Duplicate subscription cleanup completed');
      return true;

    } catch (error) {
      console.error('❌ Error cleaning up duplicate subscriptions:', error);
      return false;
    }
  }

  /**
   * Cancel user's subscription
   */
  static async cancelSubscription(
    userId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<boolean> {
    console.log('🔄 Cancelling subscription for user:', userId);

    try {
      // First, clean up any duplicate subscriptions
      await this.cleanupDuplicateSubscriptions(userId);

      // Then get the current subscription to check activation date and plan details
      const { data: currentSubscription, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            name,
            price_cents
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !currentSubscription) {
        console.error('❌ Error fetching current subscription:', fetchError);
        return false;
      }

      // Check if cancellation is within 7-day grace period
      const activationDate = new Date(currentSubscription.current_period_start);
      const now = new Date();
      const daysSinceActivation = Math.floor((now.getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log('📅 Subscription activation date:', activationDate.toISOString());
      console.log('📅 Current date:', now.toISOString());
      console.log('📅 Days since activation:', daysSinceActivation);

      const isWithinGracePeriod = daysSinceActivation < 7;
      
      if (isWithinGracePeriod) {
        console.log('⚠️ Cancellation within 7-day grace period - immediate downgrade to Free tier');
        
        // Immediate cancellation and downgrade to Free tier
        const { error: cancelError } = await supabase
          .from('user_subscriptions')
          .update({
            cancel_at_period_end: false,
            cancelled_at: new Date().toISOString()
            // Don't update status to 'cancelled' - keep as 'active' but mark as cancelled
          })
          .eq('user_id', userId)
          .eq('status', 'active');

        if (cancelError) {
          console.error('❌ Error cancelling subscription:', cancelError);
          return false;
        }

        // Immediately downgrade to Free tier
        await this.downgradeToFreeTier(userId);
        
        // Create cancellation transaction record with CORRECT plan amount
        const originalPlanAmount = (currentSubscription.subscription_plans as any)?.price_cents || 0;
        
        // Override with correct amounts based on plan name to fix database price issues
        let correctAmount = originalPlanAmount;
        const planName = (currentSubscription.subscription_plans as any)?.name?.toLowerCase() || '';
        
        if (planName.includes('small')) {
          correctAmount = 159000; // ₱159 for Small Event Org
        } else if (planName.includes('large')) {
          correctAmount = 300000; // ₱300 for Large Event Org
        }
        
        console.log('💰 Grace Period Cancellation - Plan details:', {
          planName: (currentSubscription.subscription_plans as any)?.name,
          databasePriceCents: originalPlanAmount,
          databasePricePesos: originalPlanAmount / 1000,
          correctAmountCents: correctAmount,
          correctAmountPesos: correctAmount / 1000,
          subscriptionId: currentSubscription.id
        });
        
        await this.createTransaction({
          userId,
          subscriptionId: currentSubscription.id,
          planName: `Cancelled ${(currentSubscription.subscription_plans as any)?.name || 'Subscription'} (Grace Period)`,
          originalAmountCents: correctAmount,
          netAmountCents: correctAmount,
          paymongoPaymentId: undefined,
          paymongoPaymentIntentId: undefined,
          transactionType: 'cancellation'
        });
        
        console.log('✅ Subscription cancelled and downgraded to Free tier (within grace period)');
        return true;
      } else {
        console.log('✅ Cancellation after 7-day grace period - access until expiry');
        
        // Normal cancellation (access until period end)
        const { error } = await supabase
          .from('user_subscriptions')
          .update({
            cancel_at_period_end: cancelAtPeriodEnd,
            cancelled_at: cancelAtPeriodEnd ? null : new Date().toISOString()
            // Don't update status to 'cancelled' - keep as 'active' but mark as cancelled
          })
          .eq('user_id', userId)
          .eq('status', 'active');

        if (error) {
          console.error('❌ Error cancelling subscription:', error);
          return false;
        }

        // Create cancellation transaction record with CORRECT plan amount
        const originalPlanAmount = (currentSubscription.subscription_plans as any)?.price_cents || 0;
        
        // Override with correct amounts based on plan name to fix database price issues
        let correctAmount = originalPlanAmount;
        const planName = (currentSubscription.subscription_plans as any)?.name?.toLowerCase() || '';
        
        if (planName.includes('small')) {
          correctAmount = 159000; // ₱159 for Small Event Org
        } else if (planName.includes('large')) {
          correctAmount = 300000; // ₱300 for Large Event Org
        }
        
        console.log('💰 After Grace Period Cancellation - Plan details:', {
          planName: (currentSubscription.subscription_plans as any)?.name,
          databasePriceCents: originalPlanAmount,
          databasePricePesos: originalPlanAmount / 1000,
          correctAmountCents: correctAmount,
          correctAmountPesos: correctAmount / 1000,
          subscriptionId: currentSubscription.id
        });
        
        await this.createTransaction({
          userId,
          subscriptionId: currentSubscription.id,
          planName: `Cancelled ${(currentSubscription.subscription_plans as any)?.name || 'Subscription'} (Access Until Expiry)`,
          originalAmountCents: correctAmount,
          netAmountCents: correctAmount,
          paymongoPaymentId: undefined,
          paymongoPaymentIntentId: undefined,
          transactionType: 'cancellation'
        });

        console.log('✅ Subscription cancelled - access until expiry');
        return true;
      }
    } catch (error) {
      console.error('❌ Error in cancelSubscription:', error);
      return false;
    }

    // Send notification for subscription cancellation
    try {
      // Get subscription details for notification
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            name
          )
        `)
        .eq('user_id', userId)
        .eq('status', cancelAtPeriodEnd ? 'active' : 'cancelled')
        .single();

      if (subscription) {
        const planName = (subscription.subscription_plans as any)?.name || "Unknown Plan";
        const endDate = cancelAtPeriodEnd ? subscription.current_period_end : null;
        
        await SubscriptionNotificationService.notifySubscriptionCancelled(
          userId, 
          planName, 
          endDate
        );
      }
    } catch (notifError) {
      console.warn('⚠️ Failed to send cancellation notification:', notifError);
      // Don't fail the cancellation if notification fails
    }

    return true;
  }

  /**
   * Get user's usage summary with limits and features
   */
  static async getUserUsageSummary(userId: string): Promise<{
    subscription: UserSubscriptionWithPlan | null;
    limits: SubscriptionLimits | null;
    features: SubscriptionFeatures | null;
    usage: Partial<SubscriptionLimits>;
  } | null> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription) {
      return null;
    }

    const limits = subscription.subscription_plans?.limits as unknown as SubscriptionLimits;
    const features = subscription.subscription_plans?.features as unknown as SubscriptionFeatures;

    // Get current usage for each limit
    const usagePromises = Object.keys(limits).map(async (key) => {
      const actionType = key as keyof SubscriptionLimits;
      const currentUsage = await this.getUserUsage(userId, actionType);
      return { [actionType]: currentUsage };
    });

    const usageResults = await Promise.all(usagePromises);
    const usage = usageResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

    return {
      subscription,
      limits,
      features,
      usage
    };
  }

  /**
   * Check if user can perform a specific action
   */
  static async canPerformAction(
    userId: string,
    actionType: keyof SubscriptionLimits,
    eventId?: string
  ): Promise<boolean> {
    const summary = await this.getUserUsageSummary(userId);
    
    if (!summary || !summary.limits) {
      return false;
    }

    const limit = summary.limits[actionType];
    const currentUsage = summary.usage[actionType] || 0;

    return limit === 0 || currentUsage < limit; // 0 means unlimited
  }

  /**
   * Check if user has access to a specific feature
   */
  static async hasFeatureAccess(
    userId: string,
    feature: keyof SubscriptionFeatures
  ): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription) {
      return false;
    }

    const features = subscription.subscription_plans?.features as unknown as SubscriptionFeatures;
    return features[feature] === true;
  }

  /**
   * Check and handle trial expiration
   */
  static async checkTrialExpiration(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('check_trial_expiration');
      
      if (error) {
        console.error('Error checking trial expiration:', error);
        return 0;
      }

      console.log('Trial expiration check completed:', data, 'trials expired');
      return data || 0;
    } catch (error) {
      console.error('Exception during trial expiration check:', error);
      return 0;
    }
  }
}

// Helper function to format price
export function formatPrice(cents: number, currency: string = 'PHP'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Helper function to get plan display name
export function getPlanDisplayName(planName: string): string {
  const displayNames: Record<string, string> = {
    'free': 'Free Tier',
    'small_event_org': 'Small Event Org',
    'large_event_org': 'Large Event Org',
    'free_trial': 'Free Trial'
  };
  
  return displayNames[planName] || planName;
}
