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
      stripeSubscriptionId,
      stripeCustomerId
    });

    // First, check if user already has a subscription
    console.log('🔍 Checking for existing subscription...');
    const { data: existingSubscription, error: existingError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('❌ Error checking existing subscription:', existingError);
      return null;
    }

    // Get plan details - try by ID first, then by name
    let plan = null;
    let planError = null;

    // First try to find by ID
    const { data: planById, error: planByIdError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planIdOrName)
      .single();

    if (planById && !planByIdError) {
      plan = planById;
      console.log('📋 Plan found by ID:', plan);
    } else {
      // Try to find by name
      console.log('🔍 Plan not found by ID, trying by name...');
      const { data: planByName, error: planByNameError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('name', planIdOrName)
        .single();

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
    
    if (plan.name === 'Free') {
      // Free tier has no expiry (forever)
      periodEnd.setFullYear(periodEnd.getFullYear() + 100);
    } else {
      // All other plans (Free Trial, Small Event Org, Large Event Org) are 30 days
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

    console.log('📅 Billing period:', {
      start: now.toISOString(),
      end: periodEnd.toISOString(),
      period: plan.name === 'Free' ? 'No expiry (Free tier)' : '30 days'
    });

    const subscriptionData = {
      user_id: userId,
      plan_id: plan.id, // Use the actual plan ID from database
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId
    };

    if (existingSubscription) {
      // Update existing subscription
      console.log('🔄 Updating existing subscription:', existingSubscription.id);
      console.log('💾 Updating subscription data:', subscriptionData);

      const { data, error } = await supabase
        .from('user_subscriptions')
        .update(subscriptionData)
        .eq('id', existingSubscription.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating subscription:', error);
        return null;
      }

      console.log('✅ Subscription updated successfully:', data);
      return data;
    } else {
      // Create new subscription
      console.log('🆕 Creating new subscription...');
      console.log('💾 Inserting subscription data:', subscriptionData);

      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating subscription:', error);
        return null;
      }

      console.log('✅ Subscription created successfully:', data);
      
      // Create transaction record if transaction details are provided
      if (transactionDetails) {
        await this.createTransaction({
          userId,
          subscriptionId: data.id,
          planName: plan.name,
          originalAmountCents: transactionDetails.originalAmountCents,
          netAmountCents: transactionDetails.netAmountCents,
          paymentMethodBrand: transactionDetails.paymentMethodBrand,
          paymentMethodLast4: transactionDetails.paymentMethodLast4,
          paymongoPaymentId: transactionDetails.paymongoPaymentId,
          paymongoPaymentIntentId: transactionDetails.paymongoPaymentIntentId
        });
      }
      
      return data;
    }
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
  }): Promise<any> {
    console.log('💰 Creating transaction record:', transactionData);

    const transactionRecord = {
      user_id: transactionData.userId,
      subscription_id: transactionData.subscriptionId,
      original_amount_cents: transactionData.originalAmountCents,
      net_amount_cents: transactionData.netAmountCents,
      currency: 'PHP',
      payment_method_type: 'card',
      payment_method_brand: transactionData.paymentMethodBrand,
      payment_method_last4: transactionData.paymentMethodLast4,
      paymongo_payment_id: transactionData.paymongoPaymentId,
      paymongo_payment_intent_id: transactionData.paymongoPaymentIntentId,
      status: 'paid',
      transaction_type: 'purchase',
      plan_name: transactionData.planName,
      metadata: {
        plan_name: transactionData.planName,
        original_amount: transactionData.originalAmountCents,
        net_amount: transactionData.netAmountCents,
        payment_method: transactionData.paymentMethodBrand,
        created_at: new Date().toISOString()
      }
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionRecord)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating transaction record:', error);
      return null;
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
        .select('*')
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
   * Cancel user's subscription
   */
  static async cancelSubscription(
    userId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<boolean> {
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: cancelAtPeriodEnd,
        cancelled_at: cancelAtPeriodEnd ? null : new Date().toISOString(),
        status: cancelAtPeriodEnd ? 'active' : 'cancelled'
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('Error cancelling subscription:', error);
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
