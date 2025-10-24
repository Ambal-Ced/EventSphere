"use client";

import { supabase } from "@/lib/supabase";

export interface SubscriptionNotificationData {
  userId: string;
  type: 'trial_activated' | 'subscription_purchased' | 'subscription_expiring' | 'subscription_cancelled' | 'subscription_expired';
  title: string;
  message: string;
  metadata?: any;
}

export class SubscriptionNotificationService {
  /**
   * Create a notification for subscription-related events
   */
  static async createNotification(data: SubscriptionNotificationData): Promise<boolean> {
    try {
      console.log("🔔 Creating subscription notification:", data);

      const { error } = await supabase
        .from("notifications")
        .insert({
          user_id: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          metadata: data.metadata || {},
          link_url: data.type === 'subscription_expiring' ? '/pricing' : null
        });

      if (error) {
        console.error("❌ Error creating subscription notification:", error);
        return false;
      }

      console.log("✅ Subscription notification created successfully");
      return true;
    } catch (error) {
      console.error("❌ Exception creating subscription notification:", error);
      return false;
    }
  }

  /**
   * Notify user when free trial is activated
   */
  static async notifyTrialActivated(userId: string, planName: string = "Small Event Org"): Promise<boolean> {
    return this.createNotification({
      userId,
      type: 'trial_activated',
      title: "🎉 Free Trial Activated!",
      message: `Your 30-day free trial for ${planName} has been activated! Enjoy premium features for the next 30 days.`,
      metadata: {
        plan_name: planName,
        trial_duration_days: 30,
        activated_at: new Date().toISOString()
      }
    });
  }

  /**
   * Notify user when subscription is purchased
   */
  static async notifySubscriptionPurchased(userId: string, planName: string, billingPeriod: string): Promise<boolean> {
    return this.createNotification({
      userId,
      type: 'subscription_purchased',
      title: "✅ Subscription Activated!",
      message: `Your ${planName} subscription (${billingPeriod}) has been activated successfully!`,
      metadata: {
        plan_name: planName,
        billing_period: billingPeriod,
        purchased_at: new Date().toISOString()
      }
    });
  }

  /**
   * Notify user when subscription is about to expire (7 days warning)
   */
  static async notifySubscriptionExpiring(userId: string, planName: string, daysLeft: number): Promise<boolean> {
    return this.createNotification({
      userId,
      type: 'subscription_expiring',
      title: "⚠️ Subscription Expiring Soon",
      message: `Your ${planName} subscription will expire in ${daysLeft} days. Renew now to continue enjoying premium features.`,
      metadata: {
        plan_name: planName,
        days_remaining: daysLeft,
        warning_date: new Date().toISOString()
      }
    });
  }

  /**
   * Notify user when subscription is cancelled
   */
  static async notifySubscriptionCancelled(userId: string, planName: string, endDate?: string): Promise<boolean> {
    const endDateText = endDate ? ` on ${new Date(endDate).toLocaleDateString()}` : '';
    return this.createNotification({
      userId,
      type: 'subscription_cancelled',
      title: "Subscription Cancelled",
      message: `Your ${planName} subscription has been cancelled${endDateText}. You'll continue to have access until the end of your billing period.`,
      metadata: {
        plan_name: planName,
        cancelled_at: new Date().toISOString(),
        end_date: endDate
      }
    });
  }

  /**
   * Notify user when subscription has expired
   */
  static async notifySubscriptionExpired(userId: string, planName: string): Promise<boolean> {
    return this.createNotification({
      userId,
      type: 'subscription_expired',
      title: "Subscription Expired",
      message: `Your ${planName} subscription has expired. You've been moved to the Free tier. Upgrade anytime to regain premium features.`,
      metadata: {
        plan_name: planName,
        expired_at: new Date().toISOString()
      }
    });
  }

  /**
   * Check for expiring subscriptions and send warnings
   */
  static async checkAndNotifyExpiringSubscriptions(): Promise<void> {
    try {
      console.log("🔍 Checking for expiring subscriptions...");

      // Get subscriptions expiring in 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data: expiringSubscriptions, error } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          subscription_plans (
            name
          )
        `)
        .eq("status", "active")
        .lte("current_period_end", sevenDaysFromNow.toISOString())
        .gte("current_period_end", new Date().toISOString());

      if (error) {
        console.error("❌ Error fetching expiring subscriptions:", error);
        return;
      }

      if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
        console.log("✅ No expiring subscriptions found");
        return;
      }

      console.log(`📊 Found ${expiringSubscriptions.length} expiring subscriptions`);

      // Send notifications for each expiring subscription
      for (const subscription of expiringSubscriptions) {
        const planName = (subscription.subscription_plans as any)?.name || "Unknown Plan";
        const endDate = new Date(subscription.current_period_end);
        const daysLeft = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        // Only send notification if it's exactly 7 days or less
        if (daysLeft <= 7 && daysLeft > 0) {
          await this.notifySubscriptionExpiring(subscription.user_id, planName, daysLeft);
        }
      }

      console.log("✅ Expiring subscription notifications processed");
    } catch (error) {
      console.error("❌ Error checking expiring subscriptions:", error);
    }
  }
}
