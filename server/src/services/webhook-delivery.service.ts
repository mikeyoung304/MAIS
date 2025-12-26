/**
 * Webhook Delivery Service
 * Handles outbound webhook delivery with HMAC signing
 */

import crypto from 'crypto';
import type { WebhookSubscriptionRepository } from '../lib/ports';
import type { EventEmitter } from '../lib/core/events';
import { logger } from '../lib/core/logger';

/**
 * Webhook Delivery Service
 *
 * Responsibilities:
 * - Queue webhook deliveries for tenant subscriptions
 * - Sign payloads with HMAC-SHA256
 * - Deliver webhooks via HTTP POST
 * - Track delivery status and retries
 */
export class WebhookDeliveryService {
  constructor(
    private readonly webhookSubscriptionRepo: WebhookSubscriptionRepository,
    private readonly eventEmitter: EventEmitter
  ) {
    // Subscribe to appointment events to queue webhook deliveries
    this.setupEventListeners();
  }

  /**
   * Subscribe to application events and queue webhook deliveries
   */
  private setupEventListeners(): void {
    // Listen to all appointment events
    this.eventEmitter.subscribe('AppointmentBooked', async (payload) => {
      await this.queueWebhook(payload.tenantId, 'appointment.created', payload);
    });

    this.eventEmitter.subscribe('BookingCancelled', async (payload) => {
      await this.queueWebhook(payload.tenantId, 'appointment.canceled', payload);
    });

    this.eventEmitter.subscribe('BookingRescheduled', async (payload) => {
      await this.queueWebhook(payload.tenantId, 'appointment.rescheduled', payload);
    });
  }

  /**
   * Queue webhook deliveries for an event
   *
   * Finds all active subscriptions for the event type and creates delivery records.
   * Deliveries are queued in the database for async processing.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param eventType - Event type (e.g., 'appointment.created')
   * @param payload - Event payload to deliver
   */
  async queueWebhook(
    tenantId: string,
    eventType: string,
    payload: Record<string, any>
  ): Promise<void> {
    try {
      // Find all active subscriptions for this event type
      const subscriptions = await this.webhookSubscriptionRepo.findActiveByEvent(
        tenantId,
        eventType
      );

      if (subscriptions.length === 0) {
        logger.debug({ tenantId, eventType }, 'No active webhook subscriptions for event');
        return;
      }

      // Queue deliveries for each subscription
      const deliveryPromises = subscriptions.map((subscription) =>
        this.webhookSubscriptionRepo.createDelivery({
          subscriptionId: subscription.id,
          event: eventType,
          payload,
        })
      );

      await Promise.all(deliveryPromises);

      logger.info(
        { tenantId, eventType, subscriptionCount: subscriptions.length },
        'Webhook deliveries queued'
      );

      // Immediately attempt delivery (async, fire-and-forget)
      // In production, this would be handled by a background worker
      subscriptions.forEach((subscription) => {
        this.deliverWebhook(
          subscription.id,
          subscription.url,
          subscription.secret,
          eventType,
          payload
        ).catch((error) => {
          logger.error(
            { error, subscriptionId: subscription.id, eventType },
            'Failed to deliver webhook'
          );
        });
      });
    } catch (error) {
      logger.error({ error, tenantId, eventType }, 'Failed to queue webhook deliveries');
    }
  }

  /**
   * Deliver a webhook via HTTP POST with HMAC signature
   *
   * @param subscriptionId - Subscription ID
   * @param url - Webhook endpoint URL
   * @param secret - HMAC signing secret
   * @param eventType - Event type
   * @param payload - Event payload
   */
  private async deliverWebhook(
    subscriptionId: string,
    url: string,
    secret: string,
    eventType: string,
    payload: Record<string, any>
  ): Promise<void> {
    // Find the delivery record (we just created it)
    const deliveries = await this.webhookSubscriptionRepo.findDeliveriesBySubscription(
      payload.tenantId || 'unknown',
      subscriptionId,
      1
    );

    if (deliveries.length === 0) {
      logger.error({ subscriptionId, eventType }, 'Delivery record not found');
      return;
    }

    const deliveryId = deliveries[0].id;

    try {
      // Generate HMAC signature
      const signature = this.generateHmacSignature(payload, secret);

      // Prepare webhook payload
      const webhookPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      };

      // Send HTTP POST request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'MAIS-Webhook/1.0',
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        // Mark as delivered
        await this.webhookSubscriptionRepo.markDelivered(deliveryId);
        logger.info(
          { subscriptionId, url, eventType, status: response.status },
          'Webhook delivered successfully'
        );
      } else {
        // Mark as failed
        const errorText = await response.text();
        await this.webhookSubscriptionRepo.markFailed(
          deliveryId,
          `HTTP ${response.status}: ${errorText}`
        );
        logger.error(
          { subscriptionId, url, eventType, status: response.status },
          'Webhook delivery failed'
        );
      }
    } catch (error) {
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.webhookSubscriptionRepo.markFailed(deliveryId, errorMessage);
      logger.error({ error, subscriptionId, url, eventType }, 'Webhook delivery error');
    }
  }

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   *
   * @param payload - Webhook payload
   * @param secret - HMAC signing secret
   * @returns HMAC signature (hex string)
   */
  generateHmacSignature(payload: Record<string, any>, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return hmac.digest('hex');
  }

  /**
   * Verify HMAC signature for incoming webhook (for tenant testing)
   *
   * @param payload - Webhook payload
   * @param signature - Provided signature
   * @param secret - HMAC signing secret
   * @returns True if signature is valid
   */
  verifyHmacSignature(payload: Record<string, any>, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHmacSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Test webhook endpoint by sending a test payload
   *
   * @param tenantId - Tenant ID for data isolation
   * @param subscriptionId - Subscription ID
   * @returns Delivery status
   */
  async testWebhook(
    tenantId: string,
    subscriptionId: string
  ): Promise<{ success: boolean; message: string; statusCode?: number }> {
    // Find subscription
    const subscription = await this.webhookSubscriptionRepo.findById(tenantId, subscriptionId);

    if (!subscription) {
      return { success: false, message: 'Webhook subscription not found' };
    }

    // Test payload
    const testPayload = {
      tenantId,
      test: true,
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook delivery',
    };

    try {
      // Generate HMAC signature
      const signature = this.generateHmacSignature(testPayload, subscription.secret);

      // Prepare webhook payload
      const webhookPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: testPayload,
      };

      // Send HTTP POST request
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'MAIS-Webhook/1.0',
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        logger.info(
          { tenantId, subscriptionId, url: subscription.url, status: response.status },
          'Test webhook delivered successfully'
        );
        return {
          success: true,
          message: `Webhook delivered successfully (HTTP ${response.status})`,
          statusCode: response.status,
        };
      } else {
        const _errorText = await response.text();
        logger.error(
          { tenantId, subscriptionId, url: subscription.url, status: response.status },
          'Test webhook delivery failed'
        );
        return {
          success: false,
          message: `Webhook delivery failed: HTTP ${response.status}`,
          statusCode: response.status,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { error, tenantId, subscriptionId, url: subscription.url },
        'Test webhook delivery error'
      );
      return {
        success: false,
        message: `Webhook delivery error: ${errorMessage}`,
      };
    }
  }
}
