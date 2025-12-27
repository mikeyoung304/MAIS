/**
 * Tenant Admin Billing Routes
 * Routes for tenant subscription management (Product-Led Growth)
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { StripePaymentAdapter } from '../adapters/stripe.adapter';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { logger } from '../lib/core/logger';

// Environment config for Stripe price ID
const STRIPE_SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID || 'price_placeholder';
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
   * Create Stripe Checkout session for $99/month subscription
   *
   * Redirects tenant to Stripe Checkout for payment.
   * On success, checkout.session.completed webhook updates subscriptionStatus to ACTIVE.
   */
  router.post('/checkout', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

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

      // Check if already active subscriber
      if (tenant.subscriptionStatus === 'ACTIVE') {
        res.status(400).json({ error: 'Already an active subscriber' });
        return;
      }

      // Create Stripe Checkout session for subscription
      const session = await stripeAdapter.createSubscriptionCheckout({
        tenantId,
        email: tenant.email,
        priceId: STRIPE_SUBSCRIPTION_PRICE_ID,
        successUrl: `${APP_BASE_URL}/tenant/billing?success=true`,
        cancelUrl: `${APP_BASE_URL}/tenant/billing?canceled=true`,
      });

      logger.info({ tenantId, sessionId: session.sessionId }, 'Subscription checkout session created');

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
   * GET /v1/tenant-admin/billing/status
   * Get current billing/subscription status
   *
   * Returns subscription status, trial info, and billing details.
   */
  router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
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
        daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        // Auto-expire if trial has ended
        if (daysRemaining === 0) {
          effectiveStatus = 'EXPIRED';
        }
      }

      res.json({
        subscriptionStatus: effectiveStatus,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        daysRemaining,
        stripeCustomerId: tenant.stripeCustomerId ?? null,
        plan: effectiveStatus === 'ACTIVE' ? 'Professional' : null,
        pricePerMonth: effectiveStatus === 'ACTIVE' ? 99 : null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
