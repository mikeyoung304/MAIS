/**
 * Admin routes for Stripe Connect management
 * Protected with admin authentication middleware
 *
 * Endpoints:
 * - POST   /api/v1/admin/tenants/:tenantId/stripe/connect    - Create Stripe Connect account
 * - POST   /api/v1/admin/tenants/:tenantId/stripe/onboarding - Generate onboarding link
 * - GET    /api/v1/admin/tenants/:tenantId/stripe/status     - Check account status
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma';
import { PrismaTenantRepository } from '../../adapters/prisma/tenant.repository';
import { ValidationError, NotFoundError } from '../../lib/errors';
// Types for documentation/reference (may be used in future implementation)
import type {} from '@macon/contracts';
// StripeConnectDto, StripeOnboardingLinkDto, StripeAccountStatusDto - for future use

// Import StripeConnectService (will be created by another agent)
// Assuming the service will have these methods:
// - createConnectedAccount(tenantId: string): Promise<StripeConnectDto>
// - generateOnboardingLink(tenantId: string, refreshUrl?: string, returnUrl?: string): Promise<StripeOnboardingLinkDto>
// - getAccountStatus(tenantId: string): Promise<StripeAccountStatusDto>

/**
 * Create admin Stripe routes with shared Prisma instance
 * @param prisma - Shared PrismaClient instance from DI container
 */
export function createAdminStripeRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const tenantRepo = new PrismaTenantRepository(prisma);

  // Placeholder service import - will be replaced when service is created
  let stripeConnectService: any;

  try {
    // Try to import the service if it exists
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- Dynamic require for optional dependency
    const { StripeConnectService } = require('../../services/stripe-connect.service');
    stripeConnectService = new StripeConnectService(prisma);
  } catch {
    // Service not yet created - endpoints will return appropriate error
    stripeConnectService = null;
  }

  /**
   * POST /api/v1/admin/tenants/:tenantId/stripe/connect
   * Create Stripe Connect account for tenant
   *
   * Body: (optional)
   * - country: string (default: 'US')
   * - email: string (optional, for account)
   *
   * Returns:
   * - accountId: string
   * - chargesEnabled: boolean
   * - payoutsEnabled: boolean
   * - detailsSubmitted: boolean
   */
  router.post(
    '/:tenantId/stripe/connect',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tenantId } = req.params;
        const { country = 'US', email } = req.body;

        if (!stripeConnectService) {
          throw new ValidationError(
            'StripeConnectService not available. Please ensure stripe-connect.service.ts is created.'
          );
        }

        // Verify tenant exists
        const tenant = await tenantRepo.findById(tenantId);

        if (!tenant) {
          throw new NotFoundError(`Tenant not found: ${tenantId}`);
        }

        // Check if tenant already has a Stripe account
        if (tenant.stripeAccountId) {
          throw new ValidationError(
            `Tenant ${tenantId} already has a Stripe Connect account: ${tenant.stripeAccountId}`
          );
        }

        // Create connected account
        const account = await stripeConnectService.createConnectedAccount(tenantId, {
          country,
          email,
        });

        res.status(201).json(account);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/admin/tenants/:tenantId/stripe/onboarding
   * Generate Stripe Connect onboarding link
   *
   * Body: (optional)
   * - refreshUrl: string (URL to return user if they leave onboarding)
   * - returnUrl: string (URL to return user after onboarding completion)
   *
   * Returns:
   * - url: string (onboarding URL)
   * - expiresAt: number (Unix timestamp)
   */
  router.post(
    '/:tenantId/stripe/onboarding',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tenantId } = req.params;
        const { refreshUrl, returnUrl } = req.body;

        if (!stripeConnectService) {
          throw new ValidationError(
            'StripeConnectService not available. Please ensure stripe-connect.service.ts is created.'
          );
        }

        // Verify tenant exists
        const tenant = await tenantRepo.findById(tenantId);

        if (!tenant) {
          throw new NotFoundError(`Tenant not found: ${tenantId}`);
        }

        // Require Stripe account to exist
        if (!tenant.stripeAccountId) {
          throw new ValidationError(
            `Tenant ${tenantId} does not have a Stripe Connect account. Create one first.`
          );
        }

        // Generate onboarding link
        const link = await stripeConnectService.generateOnboardingLink(
          tenantId,
          refreshUrl,
          returnUrl
        );

        res.json(link);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/admin/tenants/:tenantId/stripe/status
   * Check Stripe Connect account status
   *
   * Returns:
   * - accountId: string
   * - chargesEnabled: boolean
   * - payoutsEnabled: boolean
   * - detailsSubmitted: boolean
   * - requirements: object
   *   - currentlyDue: string[]
   *   - eventuallyDue: string[]
   *   - pastDue: string[]
   */
  router.get(
    '/:tenantId/stripe/status',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tenantId } = req.params;

        if (!stripeConnectService) {
          throw new ValidationError(
            'StripeConnectService not available. Please ensure stripe-connect.service.ts is created.'
          );
        }

        // Verify tenant exists
        const tenant = await tenantRepo.findById(tenantId);

        if (!tenant) {
          throw new NotFoundError(`Tenant not found: ${tenantId}`);
        }

        // Require Stripe account to exist
        if (!tenant.stripeAccountId) {
          throw new ValidationError(`Tenant ${tenantId} does not have a Stripe Connect account`);
        }

        // Get account status
        const status = await stripeConnectService.getAccountStatus(tenantId);

        res.json(status);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
