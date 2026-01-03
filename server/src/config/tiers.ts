/**
 * Subscription Tier Configuration
 *
 * Defines pricing tiers, AI message limits, and Stripe price IDs.
 * This is the single source of truth for all tier-related data.
 */

import { SubscriptionTier } from '../generated/prisma';

/**
 * Tier limits configuration
 * - aiMessages: Monthly AI message allowance
 * - priceCents: Monthly price in cents (0 = free)
 */
export const TIER_LIMITS = {
  FREE: { aiMessages: 50, priceCents: 0 },
  STARTER: { aiMessages: 500, priceCents: 4900 },
  PRO: { aiMessages: 5000, priceCents: 15000 },
} as const satisfies Record<SubscriptionTier, { aiMessages: number; priceCents: number }>;

/**
 * Stripe Price IDs for paid tiers
 * Set via environment variables - created in Stripe Dashboard
 *
 * To create prices:
 * 1. Go to Stripe Dashboard > Products
 * 2. Create "Handled Starter" product with $49/month recurring price
 * 3. Create "Handled Growth" product with $150/month recurring price
 * 4. Copy price IDs (price_xxx) to .env
 */
export const STRIPE_PRICES = {
  STARTER: process.env.STRIPE_STARTER_PRICE_ID ?? '',
  PRO: process.env.STRIPE_PRO_PRICE_ID ?? '',
} as const;

/**
 * Type alias for tier names
 */
export type TierName = keyof typeof TIER_LIMITS;

/**
 * Get the AI message limit for a given tier
 */
export function getTierLimit(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].aiMessages;
}

/**
 * Check if a tenant has exceeded their AI message quota
 */
export function isOverQuota(tier: SubscriptionTier, messagesUsed: number): boolean {
  return messagesUsed >= TIER_LIMITS[tier].aiMessages;
}

/**
 * Get remaining AI messages for a tenant
 */
export function getRemainingMessages(tier: SubscriptionTier, messagesUsed: number): number {
  return Math.max(0, TIER_LIMITS[tier].aiMessages - messagesUsed);
}
