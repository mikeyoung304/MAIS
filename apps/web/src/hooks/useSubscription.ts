'use client';

import { useState, useEffect, useCallback } from 'react';

const API_PROXY = '/api/tenant-admin/billing';

/**
 * Subscription tier names
 */
export type SubscriptionTier = 'FREE' | 'STARTER' | 'PRO';

/**
 * AI usage data
 */
interface AIUsage {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string | null;
}

/**
 * Subscription response from API
 */
interface SubscriptionResponse {
  tier: SubscriptionTier;
  subscriptionStatus: 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';
  trialEndsAt: string | null;
  daysRemaining: number | null;
  stripeCustomerId: string | null;
  pricePerMonth: number;
  usage: {
    aiMessages: AIUsage;
  };
}

/**
 * Hook for managing subscription state and billing
 *
 * Features:
 * - Fetches subscription status from API
 * - Provides usage tracking
 * - Handles upgrade flow via Stripe Checkout
 * - Computes derived values (isOverQuota, usagePercent)
 */
export function useSubscription() {
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_PROXY}/status`);

      if (!response.ok) {
        if (response.status === 401) {
          setData(null);
          return;
        }
        throw new Error('Failed to fetch subscription');
      }

      const subscriptionData = await response.json();
      setData(subscriptionData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Upgrade to a paid tier
  const upgrade = useCallback(async (tier: 'STARTER' | 'PRO') => {
    setIsUpgrading(true);

    try {
      const response = await fetch(`${API_PROXY}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { checkoutUrl } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upgrade';
      setError(message);
      setIsUpgrading(false);
      throw err;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Derived values
  const usage = data?.usage?.aiMessages;
  const isOverQuota = usage ? usage.remaining === 0 : false;
  const usagePercent = usage ? (usage.used / usage.limit) * 100 : 0;

  return {
    // Subscription data
    tier: data?.tier ?? 'FREE',
    status: data?.subscriptionStatus ?? 'NONE',
    trialEndsAt: data?.trialEndsAt ?? null,
    daysRemaining: data?.daysRemaining ?? null,
    pricePerMonth: data?.pricePerMonth ?? 0,

    // Usage data
    usage,
    isOverQuota,
    usagePercent,

    // Loading/Error states
    isLoading,
    error,

    // Actions
    upgrade,
    isUpgrading,
    refresh: fetchSubscription,
  };
}

export default useSubscription;
