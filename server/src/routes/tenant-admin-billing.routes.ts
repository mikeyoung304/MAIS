/**
 * Tenant Admin Billing Routes
 * Routes for tenant subscription management (Product-Led Growth)
 *
 * Supports tiered pricing:
 * - FREE: Trial tier (50 AI messages)
 * - STARTER: $49/month (500 AI messages)
 * - PRO: $150/month (5000 AI messages)
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { StripePaymentAdapter } from '../adapters/stripe.adapter';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { logger } from '../lib/core/logger';
import { TIER_LIMITS, STRIPE_PRICES, type TierName } from '../config/tiers';

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Create tenant admin billing routes
 */
export function createTenantAdminBillingRoutes(
  stripeAdapter: StripePaymentAdapter,
  tenantRepository: PrismaTenantRepository
): Router {
  const router = Router();

  /**
   * POST /v1/tenant-admin/billing/checkout
   * Create Stripe Checkout session for tiered subscription
   *
   * Request body: { tier: 'STARTER' | 'PRO' }
   *
   * Redirects tenant to Stripe Checkout for payment.
   * On success, checkout.session.completed webhook updates subscriptionStatus to ACTIVE
   * and tier to the selected tier.
   */
  router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Validate tier parameter
      const { tier } = req.body as { tier?: string };
      if (!tier || !['STARTER', 'PRO'].includes(tier)) {
        res.status(400).json({ error: 'Invalid tier. Must be STARTER or PRO.' });
        return;
      }

      const paidTier = tier as 'STARTER' | 'PRO';
      const priceId = STRIPE_PRICES[paidTier];
      if (!priceId) {
        res.status(500).json({ error: `Price ID not configured for tier: ${paidTier}` });
        return;
      }

      // Get tenant to retrieve email
      const tenant = await tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      if (!tenant.email) {
        res.status(400).json({ error: 'Tenant email is required for billing' });
        return;
      }

      // Check if already active subscriber on same or higher tier
      if (tenant.subscriptionStatus === 'ACTIVE' && tenant.tier === paidTier) {
        res.status(400).json({ error: `Already subscribed to ${paidTier}` });
        return;
      }

      // Create Stripe Checkout session for subscription
      // Include tier in metadata for webhook to use
      const session = await stripeAdapter.createSubscriptionCheckout({
        tenantId,
        email: tenant.email,
        priceId,
        successUrl: `${APP_BASE_URL}/tenant/settings/billing?success=true`,
        cancelUrl: `${APP_BASE_URL}/tenant/settings/billing?canceled=true`,
        metadata: { tier: paidTier },
      });

      logger.info(
        { tenantId, tier: paidTier, sessionId: session.sessionId },
        'Subscription checkout session created'
      );

      res.json({
        checkoutUrl: session.url,
        sessionId: session.sessionId,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create subscription checkout');
      next(error);
    }
  });

  /**
   * Shared handler for billing status
   * Used by both /status and /subscription endpoints
   */
  async function handleBillingStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const tenant = await tenantRepository.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Calculate days remaining if trialing
      let daysRemaining: number | null = null;
      let effectiveStatus = tenant.subscriptionStatus || 'NONE';

      if (effectiveStatus === 'TRIALING' && tenant.trialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(tenant.trialEndsAt);
        daysRemaining = Math.max(
          0,
          Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        // Auto-expire if trial has ended
        if (daysRemaining === 0) {
          effectiveStatus = 'EXPIRED';
        }
      }

      // Get tier info and AI usage
      const tier = (tenant.tier as TierName) || 'FREE';
      const tierLimits = TIER_LIMITS[tier];
      const aiMessagesUsed = tenant.aiMessagesUsed || 0;
      const aiMessagesLimit = tierLimits.aiMessages;
      const aiMessagesRemaining = Math.max(0, aiMessagesLimit - aiMessagesUsed);

      res.json({
        tier,
        subscriptionStatus: effectiveStatus,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        daysRemaining,
        stripeCustomerId: tenant.stripeCustomerId ?? null,
        pricePerMonth: tierLimits.priceCents / 100,
        usage: {
          aiMessages: {
            used: aiMessagesUsed,
            limit: aiMessagesLimit,
            remaining: aiMessagesRemaining,
            resetAt: tenant.aiMessagesResetAt?.toISOString() ?? null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /v1/tenant-admin/billing/status
   * Get current billing/subscription status
   *
   * Returns subscription status, tier info, trial info, and AI usage.
   */
  router.get('/status', handleBillingStatus);

  /**
   * GET /v1/tenant-admin/billing/subscription
   * Alias for /status - matches frontend naming convention
   */
  router.get('/subscription', handleBillingStatus);

  return router;
}
