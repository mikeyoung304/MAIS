/**
 * Tenant Admin Stripe Connect Routes
 * Protected routes for tenants to manage their Stripe Connect integration
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { StripeConnectService } from '../services/stripe-connect.service';
import { logger } from '../lib/core/logger';
// Errors for future use
// import { ValidationError, NotFoundError, ConflictError } from '../lib/errors';

// Validation schemas
const createAccountSchema = z.object({
  email: z.string().email(),
  businessName: z.string().min(2),
  country: z.string().length(2).default('US'),
});

const onboardingLinkSchema = z.object({
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
});

export function createTenantAdminStripeRoutes(stripeConnectService: StripeConnectService): Router {
  const router = Router();

  /**
   * POST /v1/tenant-admin/stripe/connect
   * Create Stripe Connect account for authenticated tenant
   */
  router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Validate request body
      const validation = createAccountSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.error.issues,
        });
        return;
      }

      const { email, businessName, country } = validation.data;

      // Create Stripe Connect account
      const accountId = await stripeConnectService.createConnectedAccount(
        tenantId,
        email,
        businessName,
        country
      );

      logger.info({ tenantId, accountId }, 'Stripe Connect account created');

      res.status(201).json({
        accountId,
        message: 'Stripe Connect account created successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already has Stripe account')) {
        res.status(409).json({
          error: 'Stripe account already exists for this tenant',
        });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/stripe/onboard
   * Generate Stripe Connect onboarding link
   */
  router.post('/onboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Validate request body
      const validation = onboardingLinkSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.error.issues,
        });
        return;
      }

      const { refreshUrl, returnUrl } = validation.data;

      // Generate onboarding link
      const url = await stripeConnectService.createOnboardingLink(tenantId, refreshUrl, returnUrl);

      logger.info({ tenantId }, 'Stripe onboarding link generated');

      res.json({ url });
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not have a Stripe account')) {
        res.status(404).json({
          error: 'No Stripe Connect account found. Create one first.',
        });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /v1/tenant-admin/stripe/status
   * Get Stripe Connect account status
   */
  router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Get account details
      const account = await stripeConnectService.getAccountDetails(tenantId);

      if (!account) {
        res.status(404).json({
          error: 'No Stripe Connect account found',
        });
        return;
      }

      // Map to DTO
      const status = {
        accountId: account.id,
        chargesEnabled: account.charges_enabled || false,
        payoutsEnabled: account.payouts_enabled || false,
        detailsSubmitted: account.details_submitted || false,
        requirements: {
          currentlyDue: account.requirements?.currently_due || [],
          eventuallyDue: account.requirements?.eventually_due || [],
          pastDue: account.requirements?.past_due || [],
        },
      };

      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/stripe/dashboard
   * Get Stripe Express dashboard login link
   */
  router.post('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Create login link
      const url = await stripeConnectService.createLoginLink(tenantId);

      logger.info({ tenantId }, 'Stripe dashboard login link generated');

      res.json({ url });
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not have a Stripe account')) {
        res.status(404).json({
          error: 'No Stripe Connect account found',
        });
        return;
      }
      next(error);
    }
  });

  return router;
}
