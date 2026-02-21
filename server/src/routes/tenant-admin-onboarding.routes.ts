/**
 * Tenant Admin Onboarding Routes
 *
 * Handles onboarding flow endpoints:
 * - POST /create-checkout — Create Stripe Checkout session for membership payment
 * - GET /state — Get current onboarding state (used by frontend to determine redirect)
 * - POST /intake/answer — Save a single intake answer (chat-style form)
 * - GET /intake/progress — Get current intake progress
 * - POST /intake/complete — Finalize intake, advance to BUILDING
 *
 * Mounted at: /v1/tenant-admin/onboarding
 * Protected by: tenantAuthMiddleware (JWT required)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import Stripe from 'stripe';
import type { Config } from '../lib/core/config';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { logger } from '../lib/core/logger';
import { ValidationError } from '../lib/errors';
import type { OnboardingIntakeService } from '../services/onboarding-intake.service';
import { IntakeValidationError } from '../services/onboarding-intake.service';
import { IntakeAnswerRequestSchema } from '@macon/contracts';

interface OnboardingRoutesOptions {
  config: Config;
  tenantRepo: PrismaTenantRepository;
  intakeService?: OnboardingIntakeService;
}

export function createTenantAdminOnboardingRoutes(options: OnboardingRoutesOptions): Router {
  const { config, tenantRepo, intakeService } = options;
  const router = Router();

  /**
   * POST /create-checkout
   *
   * Creates a Stripe Checkout session for the membership subscription payment.
   * Redirects user to Stripe-hosted payment page.
   *
   * Flow: Signup → Payment (this endpoint) → Stripe Checkout → Webhook → Intake Form
   *
   * Security:
   * - JWT required (tenantAuthMiddleware)
   * - Tenant must be in PENDING_PAYMENT status
   * - Dynamic URLs per tenant (institutional learning: multi-tenant-stripe-checkout-url-routing)
   * - Idempotency via Stripe Checkout session (naturally idempotent)
   */
  router.post('/create-checkout', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      // Verify tenant exists and is in correct status
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        throw new ValidationError('Tenant not found');
      }

      if (tenant.onboardingStatus !== 'PENDING_PAYMENT') {
        res.status(400).json({
          error: 'invalid_status',
          message: 'Payment already completed or not required',
          currentStatus: tenant.onboardingStatus,
        });
        return;
      }

      // Validate Stripe configuration
      if (!config.STRIPE_SECRET_KEY) {
        logger.error({ tenantId }, 'STRIPE_SECRET_KEY not configured');
        res.status(503).json({
          error: 'payment_unavailable',
          message: 'Payment processing is temporarily unavailable',
        });
        return;
      }

      if (!config.STRIPE_MEMBERSHIP_PRICE_ID) {
        logger.error({ tenantId }, 'STRIPE_MEMBERSHIP_PRICE_ID not configured');
        res.status(503).json({
          error: 'payment_unavailable',
          message: 'Payment processing is temporarily unavailable',
        });
        return;
      }

      const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
        apiVersion: '2025-10-29.clover',
        typescript: true,
      });

      // Build dynamic URLs per tenant (prevents all tenants redirecting to same URL)
      const appUrl = config.NEXTJS_APP_URL || config.CLIENT_URL || 'http://localhost:3000';
      const successUrl = `${appUrl}/onboarding/intake?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${appUrl}/onboarding/payment?cancelled=true`;

      // Create Stripe Checkout session for subscription
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: tenant.email || undefined,
        line_items: [
          {
            price: config.STRIPE_MEMBERSHIP_PRICE_ID,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          tenantId: tenant.id,
          checkoutType: 'membership',
        },
        subscription_data: {
          metadata: {
            tenantId: tenant.id,
          },
        },
      });

      logger.info(
        {
          tenantId,
          sessionId: session.id,
          event: 'checkout_session_created',
        },
        'Created Stripe Checkout session for membership payment'
      );

      res.status(200).json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /state
   *
   * Returns the current onboarding status for redirect logic.
   * Used by frontend to determine which onboarding step to show.
   */
  router.get('/state', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      res.status(200).json({
        status: tenant.onboardingStatus,
        buildStatus: tenant.buildStatus,
        redirectTo: getRedirectForStatus(tenant.onboardingStatus),
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================================
  // Intake Form Routes (Phase 3 — Conversational Intake)
  // ==========================================================================

  /**
   * POST /intake/answer
   *
   * Saves a single intake answer. Validates per-question, sanitizes, stores as discovery fact.
   *
   * Request body: { questionId: string, answer: string | string[] }
   * Response: { stored: true, questionId, nextQuestionId, answeredCount, totalQuestions }
   *
   * Requires: PENDING_INTAKE status, intakeService configured
   */
  router.post('/intake/answer', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      if (!intakeService) {
        res.status(503).json({ error: 'Intake service not configured' });
        return;
      }

      // Verify tenant is in PENDING_INTAKE status
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      if (tenant.onboardingStatus !== 'PENDING_INTAKE') {
        res.status(400).json({
          error: 'invalid_status',
          message: 'Tenant is not in intake phase',
          currentStatus: tenant.onboardingStatus,
        });
        return;
      }

      // Parse and validate request body
      const bodyValidation = IntakeAnswerRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request body',
          details: bodyValidation.error.issues,
        });
        return;
      }

      const { questionId, answer } = bodyValidation.data;

      const result = await intakeService.saveAnswer(tenantId, questionId, answer);

      logger.info({ tenantId, questionId, event: 'intake_answer_saved' }, 'Intake answer saved');

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof IntakeValidationError) {
        res.status(400).json({
          error: 'validation_error',
          message: error.message,
          details: error.issues,
        });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /intake/progress
   *
   * Returns current intake progress: answered questions, next question, can-complete flag.
   *
   * Response: { answers, answeredQuestionIds, nextQuestionId, totalQuestions, completedCount, canComplete }
   *
   * Requires: PENDING_INTAKE status, intakeService configured
   */
  router.get('/intake/progress', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      if (!intakeService) {
        res.status(503).json({ error: 'Intake service not configured' });
        return;
      }

      // Verify tenant is in PENDING_INTAKE status
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      if (tenant.onboardingStatus !== 'PENDING_INTAKE') {
        res.status(400).json({
          error: 'invalid_status',
          message: 'Tenant is not in intake phase',
          currentStatus: tenant.onboardingStatus,
        });
        return;
      }

      const result = await intakeService.getProgress(tenantId);

      logger.info(
        { tenantId, event: 'intake_progress_fetched', completedCount: result.completedCount },
        'Intake progress fetched'
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /intake/complete
   *
   * Finalizes intake form. Validates all required questions answered, advances to BUILDING.
   *
   * Response: discriminated union — { status: 'advanced_to_building' | 'missing_required' | 'already_completed', ... }
   *
   * Requires: PENDING_INTAKE status, intakeService configured
   */
  router.post('/intake/complete', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const { tenantId } = tenantAuth;

      if (!intakeService) {
        res.status(503).json({ error: 'Intake service not configured' });
        return;
      }

      const result = await intakeService.completeIntake(tenantId);

      const logEvent =
        result.status === 'advanced_to_building'
          ? 'intake_completed'
          : result.status === 'missing_required'
            ? 'intake_completion_blocked'
            : 'intake_already_completed';

      logger.info(
        { tenantId, event: logEvent, result: result.status },
        `Intake completion: ${result.status}`
      );

      // Map status to HTTP status codes
      if (result.status === 'missing_required') {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Get the redirect path for a given onboarding status
 */
function getRedirectForStatus(status: string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return '/onboarding/payment';
    case 'PENDING_INTAKE':
      return '/onboarding/intake';
    case 'BUILDING':
      return '/onboarding/build';
    case 'SETUP':
      return '/tenant/dashboard';
    case 'COMPLETE':
      return '/tenant/dashboard';
    default:
      return '/onboarding/payment';
  }
}
