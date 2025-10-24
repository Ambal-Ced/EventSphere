import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

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
   * Get billing history for user
   */
  static async getBillingHistory(userId: string): Promise<BillingHistory[]> {
    const { data, error } = await supabase
      .from('billing_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching billing history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create a new subscription for a user
   */
  static async createSubscription(
    userId: string,
    planId: string,
    stripeSubscriptionId?: string,
    stripeCustomerId?: string
  ): Promise<UserSubscription | null> {
    console.log('🔐 Creating subscription:', {
      userId,
      planId,
      stripeSubscriptionId,
      stripeCustomerId
    });

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('❌ Error fetching plan:', planError);
      return null;
    }

    console.log('📋 Plan details:', plan);

    // Calculate billing period
    const now = new Date();
    const periodEnd = new Date(now);
    
    if (plan.billing_period === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else if (plan.billing_period === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      // Forever plan
      periodEnd.setFullYear(periodEnd.getFullYear() + 100);
    }

    console.log('📅 Billing period:', {
      start: now.toISOString(),
      end: periodEnd.toISOString(),
      period: plan.billing_period
    });

    const subscriptionData = {
      user_id: userId,
      plan_id: planId,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId
    };

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
    return data;
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
