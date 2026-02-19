/**
 * Mock Webhook Repository
 *
 * In-memory implementation of WebhookRepository for testing and local development.
 */

import type { WebhookRepository } from '../../lib/ports';
import { logger } from '../../lib/core/logger';
import { webhookEvents } from './state';

export class MockWebhookRepository implements WebhookRepository {
  async isDuplicate(_tenantId: string, eventId: string): Promise<boolean> {
    const existing = webhookEvents.get(eventId);
    if (existing) {
      existing.status = 'DUPLICATE';
      return true;
    }
    return false;
  }

  async recordWebhook(input: {
    tenantId: string;
    eventId: string;
    eventType: string;
    rawPayload: string;
  }): Promise<boolean> {
    if (webhookEvents.has(input.eventId)) {
      return false;
    }
    webhookEvents.set(input.eventId, {
      eventId: input.eventId,
      eventType: input.eventType,
      status: 'PENDING',
    });
    return true;
  }

  async markProcessed(_tenantId: string, eventId: string): Promise<void> {
    const event = webhookEvents.get(eventId);
    if (event) {
      event.status = 'PROCESSED';
    }
  }

  async markFailed(_tenantId: string, eventId: string, errorMessage: string): Promise<void> {
    const event = webhookEvents.get(eventId);
    if (event) {
      event.status = 'FAILED';
    }
    logger.debug({ eventId, errorMessage }, 'Mock webhook failed');
  }
}
