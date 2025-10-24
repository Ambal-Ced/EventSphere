"use client";

import { useState, useEffect, useCallback } from 'react';
import { SubscriptionService, SubscriptionLimits, SubscriptionFeatures } from '@/lib/subscription';
import { User } from '@supabase/supabase-js';

interface SubscriptionData {
  subscription: any | null;
  limits: SubscriptionLimits | null;
  features: SubscriptionFeatures | null;
  usage: Partial<SubscriptionLimits> | null;
  loading: boolean;
  error: string | null;
}

interface UseSubscriptionReturn extends SubscriptionData {
  canPerformAction: (actionType: keyof SubscriptionLimits, eventId?: string) => Promise<boolean>;
  recordUsage: (actionType: keyof SubscriptionLimits, eventId?: string, count?: number) => Promise<void>;
  hasFeatureAccess: (feature: keyof SubscriptionFeatures) => Promise<boolean>;
  refreshSubscription: () => Promise<void>;
}

export function useSubscription(user: User | null): UseSubscriptionReturn {
  const [data, setData] = useState<SubscriptionData>({
    subscription: null,
    limits: null,
    features: null,
    usage: null,
    loading: true,
    error: null
  });

  const fetchSubscriptionData = useCallback(async () => {
    if (!user) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const summary = await SubscriptionService.getUserUsageSummary(user.id);
      
      if (summary) {
        setData(prev => ({
          ...prev,
          limits: summary.limits,
          features: summary.features,
          usage: summary.usage,
          subscription: summary.subscription,
          loading: false
        }));
      } else {
        setData(prev => ({
          ...prev,
          subscription: null,
          limits: null,
          features: null,
          usage: null,
          loading: false
        }));
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      setData(prev => ({
        ...prev,
        error: 'Failed to load subscription data',
        loading: false
      }));
    }
  }, [user]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  const canPerformAction = useCallback(async (
    actionType: keyof SubscriptionLimits, 
    eventId?: string
  ): Promise<boolean> => {
    if (!user) return false;
    return await SubscriptionService.canPerformAction(user.id, actionType, eventId);
  }, [user]);

  const recordUsage = useCallback(async (
    actionType: keyof SubscriptionLimits, 
    eventId?: string, 
    count: number = 1
  ): Promise<void> => {
    if (!user) return;
    await SubscriptionService.recordUsage(user.id, actionType, eventId, count);
    // Refresh data after recording usage
    await fetchSubscriptionData();
  }, [user, fetchSubscriptionData]);

  const hasFeatureAccess = useCallback(async (
    feature: keyof SubscriptionFeatures
  ): Promise<boolean> => {
    if (!user) return false;
    return await SubscriptionService.hasFeatureAccess(user.id, feature);
  }, [user]);

  const refreshSubscription = useCallback(async () => {
    await fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  return {
    ...data,
    canPerformAction,
    recordUsage,
    hasFeatureAccess,
    refreshSubscription
  };
}

// Hook for checking specific usage limits
export function useUsageLimit(
  user: User | null,
  actionType: keyof SubscriptionLimits,
  eventId?: string
) {
  const [currentUsage, setCurrentUsage] = useState<number>(0);
  const [limit, setLimit] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [canUse, setCanUse] = useState(false);

  const checkUsage = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get current usage
      const usage = await SubscriptionService.getUserUsage(user.id, actionType, eventId);
      setCurrentUsage(usage);

      // Check if user can perform action
      const canPerform = await SubscriptionService.canPerformAction(user.id, actionType, eventId);
      setCanUse(canPerform);

      // Get the limit from subscription
      const subscription = await SubscriptionService.getUserSubscription(user.id);
      if (subscription?.subscription_plans?.limits) {
        const limits = subscription.subscription_plans.limits as unknown as SubscriptionLimits;
        setLimit(limits[actionType] || 0);
      }
    } catch (error) {
      console.error('Error checking usage limit:', error);
    } finally {
      setLoading(false);
    }
  }, [user, actionType, eventId]);

  useEffect(() => {
    checkUsage();
  }, [checkUsage]);

  const refresh = useCallback(async () => {
    await checkUsage();
  }, [checkUsage]);

  return {
    currentUsage,
    limit,
    canUse,
    loading,
    refresh
  };
}

export function useSubscriptionPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const data = await SubscriptionService.getSubscriptionPlans();
        setPlans(data);
      } catch (err) {
        setError('Failed to load subscription plans');
        console.error('Error fetching subscription plans:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  return { plans, loading, error };
}

export function useBillingHistory(user: User | null) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await SubscriptionService.getBillingHistory(user.id);
        setHistory(data);
      } catch (err) {
        setError('Failed to load billing history');
        console.error('Error fetching billing history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  return { history, loading, error };
}
