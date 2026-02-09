/**
 * Tenant Admin Webhook Routes
 * Authenticated routes for tenant administrators to manage their webhook subscriptions
 * Requires tenant admin authentication via JWT
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import type { WebhookSubscriptionRepository } from '../lib/ports';
import type { WebhookDeliveryService } from '../services/webhook-delivery.service';
import { logger } from '../lib/core/logger';

/**
 * Zod schemas for request validation
 */
const CreateWebhookSubscriptionSchema = z.object({
  url: z.string().url({ message: 'Invalid URL format' }),
  events: z
    .array(z.enum(['appointment.created', 'appointment.canceled', 'appointment.rescheduled']))
    .min(1, { message: 'At least one event type must be selected' }),
});

const UpdateWebhookSubscriptionSchema = z.object({
  url: z.string().url({ message: 'Invalid URL format' }).optional(),
  events: z
    .array(z.enum(['appointment.created', 'appointment.canceled', 'appointment.rescheduled']))
    .min(1, { message: 'At least one event type must be selected' })
    .optional(),
  active: z.boolean().optional(),
});

/**
 * Create tenant admin webhook routes
 * All routes require tenant admin authentication (applied via middleware)
 *
 * @param webhookSubscriptionRepo - Webhook subscription repository instance
 * @param webhookDeliveryService - Webhook delivery service instance
 * @returns Express router with tenant admin webhook endpoints
 */
export function createTenantAdminWebhookRoutes(
  webhookSubscriptionRepo: WebhookSubscriptionRepository,
  webhookDeliveryService: WebhookDeliveryService
): Router {
  const router = Router();

  // ============================================================================
  // Webhook Subscription Management Endpoints
  // ============================================================================

  /**
   * GET /v1/tenant-admin/webhooks
   * List all webhook subscriptions for authenticated tenant
   *
   * @returns 200 - Array of webhook subscriptions (excludes secrets)
   * @returns 401 - Missing or invalid authentication
   * @returns 500 - Internal server error
   */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const subscriptions = await webhookSubscriptionRepo.findAll(tenantId);

      res.json(subscriptions);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/tenant-admin/webhooks/:id
   * Get a specific webhook subscription by ID
   *
   * @returns 200 - Webhook subscription (includes secret for viewing/copying)
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Webhook subscription not found
   * @returns 500 - Internal server error
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;
      const { id } = req.params;

      const subscription = await webhookSubscriptionRepo.findById(tenantId, id);

      if (!subscription) {
        res.status(404).json({ error: 'Webhook subscription not found' });
        return;
      }

      res.json(subscription);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/webhooks
   * Create a new webhook subscription
   *
   * Request body:
   * {
   *   url: string,           // Webhook endpoint URL
   *   events: string[]       // Event types to subscribe to
   * }
   *
   * @returns 201 - Created webhook subscription (with generated secret)
   * @returns 400 - Validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 409 - URL already subscribed for this tenant
   * @returns 500 - Internal server error
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Validate request body
      const data = CreateWebhookSubscriptionSchema.parse(req.body);

      // Check for duplicate URL
      const existingSubscriptions = await webhookSubscriptionRepo.findAll(tenantId);
      const duplicate = existingSubscriptions.find((sub) => sub.url === data.url);
      if (duplicate) {
        res.status(409).json({ error: 'Webhook subscription already exists for this URL' });
        return;
      }

      // Generate HMAC signing secret
      const secret = crypto.randomBytes(32).toString('hex');

      // Create subscription
      const subscription = await webhookSubscriptionRepo.create(tenantId, {
        url: data.url,
        events: data.events,
        secret,
      });

      logger.info(
        { tenantId, subscriptionId: subscription.id, url: subscription.url },
        'Webhook subscription created by tenant admin'
      );

      res.status(201).json(subscription);
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /v1/tenant-admin/webhooks/:id
   * Update a webhook subscription
   *
   * Request body (all fields optional):
   * {
   *   url?: string,          // Webhook endpoint URL
   *   events?: string[],     // Event types to subscribe to
   *   active?: boolean       // Enable/disable subscription
   * }
   *
   * @returns 200 - Updated webhook subscription
   * @returns 400 - Validation error
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Webhook subscription not found
   * @returns 500 - Internal server error
   */
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;
      const { id } = req.params;

      // Validate request body
      const data = UpdateWebhookSubscriptionSchema.parse(req.body);

      // Update subscription
      const updated = await webhookSubscriptionRepo.update(tenantId, id, data);

      logger.info(
        { tenantId, subscriptionId: id, url: updated.url },
        'Webhook subscription updated by tenant admin'
      );

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant-admin/webhooks/:id
   * Delete a webhook subscription
   *
   * @returns 204 - Webhook subscription deleted
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Webhook subscription not found
   * @returns 500 - Internal server error
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;
      const { id } = req.params;

      await webhookSubscriptionRepo.delete(tenantId, id);

      logger.info({ tenantId, subscriptionId: id }, 'Webhook subscription deleted by tenant admin');

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/webhooks/:id/test
   * Test a webhook endpoint by sending a test payload
   *
   * @returns 200 - Test result (success/failure)
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Webhook subscription not found
   * @returns 500 - Internal server error
   */
  router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;
      const { id } = req.params;

      // Test webhook delivery
      const result = await webhookDeliveryService.testWebhook(tenantId, id);

      logger.info(
        { tenantId, subscriptionId: id, success: result.success },
        'Webhook test initiated by tenant admin'
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/tenant-admin/webhooks/:id/deliveries
   * Get delivery history for a webhook subscription
   *
   * @returns 200 - Array of webhook deliveries
   * @returns 401 - Missing or invalid authentication
   * @returns 404 - Webhook subscription not found
   * @returns 500 - Internal server error
   */
  router.get('/:id/deliveries', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;
      const { id } = req.params;

      // Get deliveries (limit to last 100)
      const deliveries = await webhookSubscriptionRepo.findDeliveriesBySubscription(
        tenantId,
        id,
        100
      );

      res.json(deliveries);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
